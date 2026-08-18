"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { getAppUrl } from "@/lib/settings";
import { grantAccess, grantTargetsFor } from "@/lib/grants";
import { recordConversion } from "@/lib/integrations/hub";

export type StoreState = { error?: string; notice?: string };

/**
 * Buy one product outright.
 *
 * With Stripe configured this opens a one-time Checkout session and the
 * webhook grants access. Without it, the grant is applied locally so the whole
 * flow is testable before the Stripe account exists.
 */
export async function buyProductAction(
  _prev: StoreState,
  formData: FormData,
): Promise<StoreState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };

  const productId = String(formData.get("productId") ?? "");
  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product || !product.isActive) {
    return { error: "That product is not available." };
  }

  const targets = grantTargetsFor(product);
  if (targets.length === 0) {
    return {
      error: "That product isn't linked to any content yet. Contact support.",
    };
  }

  // Don't charge twice for something they already hold.
  const existing = await db.accessGrant.findMany({
    where: {
      userId: user.id,
      OR: targets.map((t) => ({
        contentType: t.contentType,
        contentId: t.contentId,
      })),
    },
  });
  if (existing.length === targets.length) {
    return { error: "You already have access to everything in this product." };
  }

  if (!stripeConfigured()) {
    await grantAccess(user.id, targets, {
      source: "PURCHASE",
      productId: product.id,
      note: "demo mode purchase",
    });
    await db.payment.create({
      data: {
        userId: user.id,
        amountCents: product.priceCents,
        currency: product.currency,
        status: "succeeded",
        kind: "one_off",
        description: `${product.name} — demo mode`,
      },
    });
    const headerList = await headers();
    await recordConversion({
      type: "PURCHASE",
      userId: user.id,
      channelId: user.attributedChannelId,
      valueCents: product.priceCents,
      currency: product.currency,
      campaign: user.attributionCampaign,
      clickId: user.landingClickId,
      email: user.email,
      firstName: user.name.split(" ")[0],
      dedupeScope: `demo-product-${product.id}-${Date.now()}`,
      clientIp: headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: headerList.get("user-agent"),
    });

    revalidatePath("/store");
    // Redirect rather than returning a notice: once the grant exists the card
    // re-renders as "Owned" and unmounts the button holding any inline state,
    // so the confirmation has to come from the page itself.
    redirect("/store?purchase=demo");
  }

  const stripe = getStripe()!;
  const appUrl = await getAppUrl();

  let customerId = user.stripeCustomerId;
  let url: string | null = null;

  try {
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await db.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: product.stripePriceId
        ? [{ price: product.stripePriceId, quantity: 1 }]
        : [
            {
              // Falls back to an inline price so a product is sellable the
              // moment it is created, before a Stripe Price exists for it.
              price_data: {
                currency: product.currency,
                unit_amount: product.priceCents,
                product_data: {
                  name: product.name,
                  description: product.description.slice(0, 500),
                },
              },
              quantity: 1,
            },
          ],
      success_url: `${appUrl}/store?purchase=success`,
      cancel_url: `${appUrl}/store?purchase=cancelled`,
      metadata: {
        userId: user.id,
        productId: product.id,
        kind: "product",
        channelId: user.attributedChannelId ?? "",
        clickId: user.landingClickId ?? "",
      },
      allow_promotion_codes: true,
    });
    url = session.url;
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? `Stripe rejected the request: ${error.message}`
          : "Could not start checkout.",
    };
  }

  if (!url) return { error: "Stripe did not return a checkout URL." };
  redirect(url);
}
