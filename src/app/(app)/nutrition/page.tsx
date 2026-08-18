import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { accessContextFor, accessReason } from "@/lib/entitlements";
import { MacroCalculator } from "@/components/macro-calculator";
import { PageHeader, Badge, LockBadge, ButtonLink, Card } from "@/components/ui";

export const metadata: Metadata = { title: "Nutrition" };
export const dynamic = "force-dynamic";

const GOAL_TONE = {
  cut: "info",
  bulk: "warning",
  recomp: "volt",
  maintain: "neutral",
} as const;

export default async function NutritionPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { entitlement, accessKeys } = await accessContextFor(user);

  const plans = await db.dietPlan.findMany({
    where: { isPublished: true },
    orderBy: { kcalTarget: "asc" },
    include: { _count: { select: { meals: true } } },
  });

  return (
    <>
      <PageHeader
        eyebrow="Nutrition"
        title="Diet plans"
        description="Complete day-by-day plans where the macros actually add up to the target. Pick the one that matches your goal, or work out your numbers first."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="grid gap-4 lg:col-span-2 lg:grid-cols-2">
          {plans.map((plan) => {
            const reason = accessReason(entitlement, accessKeys, {
              type: "DIET_PLAN",
              id: plan.id,
              minTier: plan.minTier,
            });
            const locked = reason === "locked";
            return (
              <div key={plan.id} className="card flex flex-col p-5">
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

                <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                  <MacroCell label="kcal" value={plan.kcalTarget} />
                  <MacroCell label="protein" value={`${plan.proteinG}g`} />
                  <MacroCell label="carbs" value={`${plan.carbsG}g`} />
                  <MacroCell label="fat" value={`${plan.fatG}g`} />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge tone={GOAL_TONE[plan.goal as keyof typeof GOAL_TONE] ?? "neutral"}>
                    {plan.goal}
                  </Badge>
                  <Badge>{plan.durationDays} days</Badge>
                  <Badge>{plan._count.meals} meals</Badge>
                </div>

                <div className="mt-5">
                  {locked ? (
                    <ButtonLink href="/account/billing" variant="secondary" className="w-full">
                      Unlock with Core
                    </ButtonLink>
                  ) : (
                    <ButtonLink href={`/nutrition/${plan.slug}`} className="w-full">
                      Open plan
                    </ButtonLink>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-4">
          <MacroCalculator />
          <Card>
            <h3 className="text-sm font-semibold">How to use these</h3>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-ink-400">
              <li>
                · Pick the plan whose calorie target is closest to your calculated
                number. Do not build your own on day one.
              </li>
              <li>
                · Run it for two full weeks before judging it. Weight moves in steps,
                not lines.
              </li>
              <li>
                · The meals repeat on purpose. Repetition is what makes a diet
                survivable on a work week.
              </li>
              <li>
                · Protein is the number to defend when you have to cut something.
              </li>
            </ul>
            <Link
              href="/knowledge/protein-target"
              className="mt-3 inline-block text-xs font-medium text-volt-500 hover:underline"
            >
              Read: setting a protein target →
            </Link>
          </Card>
        </div>
      </div>
    </>
  );
}

function MacroCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-850 py-2">
      <p className="text-sm font-bold tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-ink-400">{label}</p>
    </div>
  );
}
