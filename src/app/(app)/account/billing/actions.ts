"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { getAppUrl } from "@/lib/settings";
import { recordConversion } from "@/lib/integrations/hub";

export type BillingState = { error?: string; notice?: string };

/**
 * Start a subscription.
 *
 * With Stripe configured this creates a Checkout Session and redirects.
 * Without it, the app falls back to a clearly-labelled demo subscription so
 * the whole product is testable before the Stripe account is live.
 */
export async function startCheckoutAction(
  _prev: BillingState,
  formData: FormData,
): Promise<BillingState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };

  const planKey = String(formData.get("planKey") ?? "");
  const interval = String(formData.get("interval") ?? "month");

  const plan = await db.plan.findUnique({ where: { key: planKey } });
  if (!plan || !plan.isActive) return { error: "That plan is not available." };
  if (plan.tier === 0) return { error: "The free plan needs no checkout." };

  const priceCents =
    interval === "year" ? plan.priceYearlyCents : plan.priceMonthlyCents;

  if (!stripeConfigured()) {
    await activateDemoSubscription(user.id, plan.id, interval, priceCents);
    revalidatePath("/account/billing");
    return {
      notice: `Demo mode: ${plan.name} activated locally. Add STRIPE_SECRET_KEY to take real payments.`,
    };
  }

  const stripe = getStripe()!;
  const appUrl = await getAppUrl();
  const priceId =
    interval === "year" ? plan.stripePriceIdYearly : plan.stripePriceIdMonthly;

  if (!priceId) {
    return {
      error: `No Stripe price is configured for ${plan.name} (${interval}ly). Set it in the plan record.`,
    };
  }

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
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/account/billing?checkout=success`,
      cancel_url: `${appUrl}/account/billing?checkout=cancelled`,
      subscription_data: {
        trial_period_days: plan.trialDays > 0 ? plan.trialDays : undefined,
        metadata: { userId: user.id, planId: plan.id },
      },
      // Carried through to the webhook so we can attribute the revenue.
      metadata: {
        userId: user.id,
        planId: plan.id,
        interval,
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

/** Open the Stripe customer portal so members manage their own billing. */
export async function openBillingPortalAction(
  _prev: BillingState,
  _formData: FormData,
): Promise<BillingState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };

  if (!stripeConfigured()) {
    return {
      error: "The billing portal needs Stripe. Add STRIPE_SECRET_KEY to enable it.",
    };
  }
  if (!user.stripeCustomerId) {
    return { error: "No billing account yet — start a subscription first." };
  }

  let url: string;
  try {
    const session = await getStripe()!.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${await getAppUrl()}/account/billing`,
    });
    url = session.url;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not open the portal.",
    };
  }

  redirect(url);
}

/** Cancel at period end — members keep what they paid for. */
export async function cancelSubscriptionAction(
  _prev: BillingState,
  formData: FormData,
): Promise<BillingState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };

  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  const sub = await db.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub || sub.userId !== user.id) return { error: "Subscription not found." };

  if (stripeConfigured() && sub.stripeSubscriptionId) {
    try {
      await getStripe()!.subscriptions.update(sub.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Stripe could not cancel it.",
      };
    }
  }

  await db.subscription.update({
    where: { id: sub.id },
    data: { cancelAtPeriodEnd: true },
  });

  revalidatePath("/account/billing");
  return {
    notice: "Your plan will not renew. You keep access until the end of the period.",
  };
}

export async function resumeSubscriptionAction(
  _prev: BillingState,
  formData: FormData,
): Promise<BillingState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };

  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  const sub = await db.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub || sub.userId !== user.id) return { error: "Subscription not found." };

  if (stripeConfigured() && sub.stripeSubscriptionId) {
    try {
      await getStripe()!.subscriptions.update(sub.stripeSubscriptionId, {
        cancel_at_period_end: false,
      });
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Stripe could not resume it.",
      };
    }
  }

  await db.subscription.update({
    where: { id: sub.id },
    data: { cancelAtPeriodEnd: false },
  });

  revalidatePath("/account/billing");
  return { notice: "Your plan will renew as normal." };
}

/**
 * Local subscription used when Stripe is not configured. Records the same
 * payment and conversion rows a real checkout would, so the revenue console
 * and the attribution reporting can be exercised end to end.
 */
async function activateDemoSubscription(
  userId: string,
  planId: string,
  interval: string,
  priceCents: number,
) {
  const plan = await db.plan.findUniqueOrThrow({ where: { id: planId } });

  await db.subscription.updateMany({
    where: { userId, status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } },
    data: { status: "CANCELED", canceledAt: new Date() },
  });

  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + (interval === "year" ? 12 : 1));

  await db.subscription.create({
    data: {
      userId,
      planId,
      status: plan.trialDays > 0 ? "TRIALING" : "ACTIVE",
      interval,
      currentPeriodEnd: periodEnd,
      trialEndsAt:
        plan.trialDays > 0
          ? new Date(Date.now() + plan.trialDays * 864e5)
          : null,
      coachingCreditsLeft: plan.coachingCreditsPerMonth,
    },
  });

  await db.payment.create({
    data: {
      userId,
      amountCents: priceCents,
      status: "succeeded",
      kind: "subscription",
      description: `${plan.name} (${interval}ly) — demo mode`,
    },
  });

  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const headerList = await headers();

  await recordConversion({
    type: plan.trialDays > 0 ? "TRIAL_START" : "SUBSCRIBE",
    userId,
    channelId: user.attributedChannelId,
    valueCents: priceCents,
    campaign: user.attributionCampaign,
    clickId: user.landingClickId,
    email: user.email,
    firstName: user.name.split(" ")[0],
    dedupeScope: `demo-${Date.now()}`,
    clientIp: headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: headerList.get("user-agent"),
  });
}
