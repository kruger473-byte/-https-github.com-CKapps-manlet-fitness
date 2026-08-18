import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { entitlementFor, formatMoney } from "@/lib/entitlements";
import { stripeConfigured } from "@/lib/stripe";
import { PlanPicker, ManageSubscription } from "@/components/billing-panel";
import {
  startCheckoutAction,
  openBillingPortalAction,
  cancelSubscriptionAction,
  resumeSubscriptionAction,
} from "./actions";
import { PageHeader, Card, Badge, Alert, Stat } from "@/components/ui";

export const metadata: Metadata = { title: "Billing" };
export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; plan?: string }>;
}) {
  const { checkout } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const entitlement = entitlementFor(user.subscriptions);
  const [plans, payments] = await Promise.all([
    db.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    db.payment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  const activeSub = user.subscriptions.find(
    (s) => s.plan.tier === entitlement.tier && entitlement.tier > 0,
  );

  const totalPaid = payments
    .filter((p) => p.status === "succeeded")
    .reduce((n, p) => n + p.amountCents, 0);

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Billing & plan"
        description="Change plan, manage your card, or cancel. Cancelling always keeps access until the end of the period you paid for."
      />

      {checkout === "success" ? (
        <div className="mb-6">
          <Alert tone="success">
            Payment received. Your plan updates as soon as Stripe confirms the
            subscription — usually within a few seconds.
          </Alert>
        </div>
      ) : null}
      {checkout === "cancelled" ? (
        <div className="mb-6">
          <Alert tone="info">Checkout cancelled. Nothing was charged.</Alert>
        </div>
      ) : null}
      {entitlement.inGracePeriod ? (
        <div className="mb-6">
          <Alert tone="danger">
            Your last payment failed. You keep full access while the card is retried —
            update your payment method below to avoid an interruption.
          </Alert>
        </div>
      ) : null}

      <div className="mb-8 grid gap-4 sm:grid-cols-4">
        <Stat label="Current plan" value={entitlement.planName} sub={entitlement.status.toLowerCase()} />
        <Stat
          label="Renews"
          value={
            entitlement.currentPeriodEnd
              ? entitlement.currentPeriodEnd.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "—"
          }
          sub={entitlement.cancelAtPeriodEnd ? "will not renew" : "auto-renews"}
          tone={entitlement.cancelAtPeriodEnd ? "bad" : "neutral"}
        />
        <Stat
          label="Coaching credits"
          value={String(entitlement.coachingCreditsLeft)}
          sub={entitlement.includesCoaching ? "this period" : "not included"}
        />
        <Stat label="Paid to date" value={formatMoney(totalPaid)} sub="lifetime" />
      </div>

      {activeSub ? (
        <Card className="mb-8">
          <h2 className="mb-1 text-sm font-semibold">Manage your subscription</h2>
          <p className="mb-4 text-xs text-ink-400">
            {entitlement.cancelAtPeriodEnd
              ? "Your plan is set to end at the close of this period."
              : "Renews automatically. Cancel any time, no phone call required."}
          </p>
          <ManageSubscription
            subscriptionId={activeSub.id}
            cancelAtPeriodEnd={entitlement.cancelAtPeriodEnd}
            portalAction={openBillingPortalAction}
            cancelAction={cancelSubscriptionAction}
            resumeAction={resumeSubscriptionAction}
            stripeReady={stripeConfigured()}
          />
        </Card>
      ) : null}

      <section className="mb-10">
        <h2 className="mb-4 text-base font-semibold">
          {entitlement.tier === 0 ? "Choose a plan" : "Change plan"}
        </h2>
        <PlanPicker
          stripeReady={stripeConfigured()}
          currentTier={entitlement.tier}
          action={startCheckoutAction}
          plans={plans.map((p) => ({
            id: p.id,
            key: p.key,
            name: p.name,
            tagline: p.tagline,
            tier: p.tier,
            monthly: formatMoney(p.priceMonthlyCents, p.currency),
            yearly: formatMoney(p.priceYearlyCents, p.currency),
            monthlyCents: p.priceMonthlyCents,
            trialDays: p.trialDays,
            features: JSON.parse(p.features) as string[],
          }))}
        />
      </section>

      <section>
        <h2 className="mb-4 text-base font-semibold">Payment history</h2>
        {payments.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-400">No payments yet.</p>
          </Card>
        ) : (
          <Card className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-left text-xs uppercase tracking-wider text-ink-400">
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Description</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-5 py-3 text-ink-400">
                      {p.createdAt.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-3">{p.description ?? p.kind}</td>
                    <td className="px-5 py-3">
                      <Badge tone={p.status === "succeeded" ? "success" : "danger"}>
                        {p.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {formatMoney(p.amountCents, p.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </>
  );
}
