import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { accessContextFor, accessReason, formatMoney } from "@/lib/entitlements";
import {
  PageHeader,
  Badge,
  LockBadge,
  ButtonLink,
  Card,
  EmptyState,
  Alert,
} from "@/components/ui";

export const metadata: Metadata = { title: "Supplements" };
export const dynamic = "force-dynamic";

export default async function SupplementsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { entitlement, accessKeys } = await accessContextFor(user);

  const plans = await db.supplementPlan.findMany({
    where: { isPublished: true },
    orderBy: { sortOrder: "asc" },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  return (
    <>
      <PageHeader
        eyebrow="Supplements"
        title="Supplement plans"
        description="Short lists of things with evidence behind them, and an honest note about how strong that evidence is. Most of what's sold to lifters is not on here."
      />

      <div className="mb-6">
        <Alert tone="info">
          Supplements are the smallest lever you have. Training, calories, protein
          and sleep account for almost all of the result — get those right first.
        </Alert>
      </div>

      {plans.length === 0 ? (
        <EmptyState
          title="No supplement plans yet"
          description="Once plans are published they'll appear here."
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {plans.map((plan) => {
            const reason = accessReason(entitlement, accessKeys, {
              type: "SUPPLEMENT_PLAN",
              id: plan.id,
              minTier: plan.minTier,
            });
            const locked = reason === "locked";
            const core = plan.items.filter((i) => i.tier === "core");
            const monthlyCost = core.reduce((n, i) => n + i.monthlyCostCents, 0);

            return (
              <Card key={plan.id} className="flex flex-col">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h2 className="text-base font-semibold">{plan.title}</h2>
                  {locked ? (
                    <LockBadge tier={plan.minTier} />
                  ) : reason === "purchased" ? (
                    <Badge tone="success">Purchased</Badge>
                  ) : null}
                </div>
                <p className="flex-1 text-sm leading-relaxed text-ink-400">
                  {plan.description}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge>{plan.goal}</Badge>
                  <Badge>{core.length} core items</Badge>
                  {monthlyCost > 0 ? (
                    <Badge>~{formatMoney(monthlyCost)}/month</Badge>
                  ) : null}
                </div>

                <div className="mt-5">
                  {locked ? (
                    <ButtonLink href="/account/billing" variant="secondary" className="w-full">
                      Unlock with {plan.minTier >= 2 ? "Elite" : "Core"}
                    </ButtonLink>
                  ) : (
                    <ButtonLink href={`/supplements/${plan.slug}`} className="w-full">
                      Open plan
                    </ButtonLink>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
