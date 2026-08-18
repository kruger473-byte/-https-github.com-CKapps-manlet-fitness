import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getStripe, mapStripeStatus } from "@/lib/stripe";
import { recordConversion } from "@/lib/integrations/hub";
import { grantAccess, grantTargetsFor } from "@/lib/grants";

/**
 * Stripe webhook — the authority on subscription state.
 *
 * Checkout redirects can be abandoned, blocked or replayed, so entitlement is
 * never granted from the browser's success URL. It is granted here, from a
 * signed event, and every event id is stored so a Stripe retry is a no-op.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe || !env.stripe.webhookSecret) {
    return NextResponse.json(
      { error: "Stripe is not configured on this deployment." },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.stripe.webhookSecret);
  } catch (error) {
    return NextResponse.json(
      {
        error: `Signature verification failed: ${
          error instanceof Error ? error.message : "unknown"
        }`,
      },
      { status: 400 },
    );
  }

  // Idempotency: Stripe retries until it gets a 2xx.
  const seen = await db.webhookEvent.findUnique({ where: { id: event.id } });
  if (seen) return NextResponse.json({ received: true, deduplicated: true });

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handleInvoiceFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        break;
    }

    await db.webhookEvent.create({
      data: {
        id: event.id,
        type: event.type,
        payload: JSON.stringify(event.data.object).slice(0, 10000),
      },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    // Return 500 so Stripe retries rather than dropping the event.
    console.error(`Webhook ${event.type} (${event.id}) failed:`, error);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  if (!userId) return;

  if (session.customer && typeof session.customer === "string") {
    await db.user.update({
      where: { id: userId },
      data: { stripeCustomerId: session.customer },
    });
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const isProduct = session.metadata?.kind === "product";

  // One-off purchase: grant the content this product unlocks. Grants are
  // upserted, so a replayed webhook is harmless.
  if (isProduct && session.metadata?.productId) {
    const product = await db.product.findUnique({
      where: { id: session.metadata.productId },
    });
    if (product) {
      await grantAccess(user.id, grantTargetsFor(product), {
        source: "PURCHASE",
        productId: product.id,
      });
      await db.payment.upsert({
        where: { stripeObjectId: session.id },
        update: { status: "succeeded" },
        create: {
          userId: user.id,
          amountCents: session.amount_total ?? product.priceCents,
          currency: session.currency ?? product.currency,
          status: "succeeded",
          kind: "one_off",
          description: product.name,
          stripeObjectId: session.id,
        },
      });
    }
  }

  // Attribute the sale to the channel that earned it.
  await recordConversion({
    type: isProduct ? "PURCHASE" : "SUBSCRIBE",
    userId,
    channelId: session.metadata?.channelId || user.attributedChannelId,
    valueCents: session.amount_total ?? 0,
    currency: session.currency ?? "usd",
    campaign: user.attributionCampaign,
    clickId: session.metadata?.clickId || user.landingClickId,
    dedupeScope: session.id,
    email: user.email,
    firstName: user.name.split(" ")[0],
  });
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;
  const planId = subscription.metadata?.planId;

  const user = userId
    ? await db.user.findUnique({ where: { id: userId } })
    : await db.user.findFirst({
        where: { stripeCustomerId: String(subscription.customer) },
      });
  if (!user) return;

  const plan = planId
    ? await db.plan.findUnique({ where: { id: planId } })
    : await db.plan.findFirst({ where: { key: "core" } });
  if (!plan) return;

  const item = subscription.items.data[0];
  const interval = item?.price?.recurring?.interval ?? "month";
  const periodStart = item?.current_period_start ?? subscription.start_date;
  const periodEnd = item?.current_period_end;

  const data = {
    userId: user.id,
    planId: plan.id,
    status: mapStripeStatus(subscription.status),
    interval,
    currentPeriodStart: new Date(periodStart * 1000),
    currentPeriodEnd: new Date(
      (periodEnd ?? Math.floor(Date.now() / 1000) + 30 * 86400) * 1000,
    ),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
    trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
  };

  const existing = await db.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (existing) {
    await db.subscription.update({ where: { id: existing.id }, data });
  } else {
    await db.subscription.create({
      data: {
        ...data,
        stripeSubscriptionId: subscription.id,
        coachingCreditsLeft: plan.coachingCreditsPerMonth,
      },
    });
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const existing = await db.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });
  if (!existing) return;

  await db.subscription.update({
    where: { id: existing.id },
    data: { status: "CANCELED", canceledAt: new Date(), cancelAtPeriodEnd: false },
  });

  const user = await db.user.findUnique({ where: { id: existing.userId } });
  if (user) {
    await recordConversion({
      type: "CHURN",
      userId: user.id,
      channelId: user.attributedChannelId,
      dedupeScope: subscription.id,
      email: user.email,
    });
  }
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const customerId =
    typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const user = await db.user.findFirst({ where: { stripeCustomerId: customerId } });
  if (!user) return;

  await db.payment.upsert({
    where: { stripeObjectId: invoice.id ?? `invoice-${Date.now()}` },
    update: { status: "succeeded" },
    create: {
      userId: user.id,
      amountCents: invoice.amount_paid,
      currency: invoice.currency,
      status: "succeeded",
      kind: "subscription",
      description: invoice.lines.data[0]?.description ?? "Subscription payment",
      stripeObjectId: invoice.id,
    },
  });

  // A renewal that follows a recovered failure should restore access.
  await db.subscription.updateMany({
    where: { userId: user.id, status: "PAST_DUE" },
    data: { status: "ACTIVE" },
  });

  // Monthly coaching credits reset on each successful billing period.
  const active = await db.subscription.findFirst({
    where: { userId: user.id, status: { in: ["ACTIVE", "TRIALING"] } },
    include: { plan: true },
  });
  if (active && active.plan.coachingCreditsPerMonth > 0) {
    await db.subscription.update({
      where: { id: active.id },
      data: { coachingCreditsLeft: active.plan.coachingCreditsPerMonth },
    });
  }
}

async function handleInvoiceFailed(invoice: Stripe.Invoice) {
  const customerId =
    typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const user = await db.user.findFirst({ where: { stripeCustomerId: customerId } });
  if (!user) return;

  await db.payment.upsert({
    where: { stripeObjectId: invoice.id ?? `invoice-failed-${Date.now()}` },
    update: { status: "failed" },
    create: {
      userId: user.id,
      amountCents: invoice.amount_due,
      currency: invoice.currency,
      status: "failed",
      kind: "subscription",
      description: "Failed payment",
      stripeObjectId: invoice.id,
    },
  });

  // Grace period, not a lockout — Stripe will retry the card.
  await db.subscription.updateMany({
    where: { userId: user.id, status: { in: ["ACTIVE", "TRIALING"] } },
    data: { status: "PAST_DUE" },
  });
}
