import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { accessContextFor, canAccessContent, formatMoney } from "@/lib/entitlements";
import { PageHeader, Badge, ButtonLink, Card, Alert, LockIcon } from "@/components/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const plan = await db.supplementPlan.findUnique({ where: { slug } });
  return { title: plan?.title ?? "Supplement plan" };
}

const TIER_TONE = {
  core: "volt",
  optional: "neutral",
  situational: "info",
} as const;

const TIER_BLURB: Record<string, string> = {
  core: "Worth taking consistently — the evidence is solid.",
  optional: "Small or uncertain effect. Fine to skip.",
  situational: "Only useful if the specific situation applies to you.",
};

export default async function SupplementPlanPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const plan = await db.supplementPlan.findUnique({
    where: { slug },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!plan || !plan.isPublished) notFound();

  const { entitlement, accessKeys } = await accessContextFor(user);
  const allowed = canAccessContent(entitlement, accessKeys, {
    type: "SUPPLEMENT_PLAN",
    id: plan.id,
    minTier: plan.minTier,
  });

  if (!allowed) {
    return (
      <>
        <Link href="/supplements" className="text-sm text-ink-400 hover:text-ink-100">
          ← Supplements
        </Link>
        <Card className="mt-6 border-volt-500/30 text-center">
          <LockIcon className="mx-auto h-8 w-8 text-volt-500" />
          <h1 className="mt-3 text-lg font-bold">{plan.title}</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-400">{plan.description}</p>
          <ButtonLink href="/account/billing" className="mt-5">
            Unlock this plan
          </ButtonLink>
        </Card>
      </>
    );
  }

  const groups = ["core", "optional", "situational"] as const;
  const monthlyCore = plan.items
    .filter((i) => i.tier === "core")
    .reduce((n, i) => n + i.monthlyCostCents, 0);

  return (
    <>
      <Link href="/supplements" className="text-sm text-ink-400 hover:text-ink-100">
        ← Supplements
      </Link>

      <div className="mt-4 max-w-3xl">
        <PageHeader
          eyebrow={plan.goal}
          title={plan.title}
          description={plan.description}
        />

        <div className="mb-6">
          <Alert tone="warning">{plan.disclaimer}</Alert>
        </div>

        {monthlyCore > 0 ? (
          <Card className="mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Core stack cost</p>
                <p className="text-xs text-ink-400">
                  Rough monthly total for the core items only
                </p>
              </div>
              <p className="text-2xl font-bold tabular-nums text-volt-500">
                {formatMoney(monthlyCore)}
                <span className="text-xs font-normal text-ink-400">/month</span>
              </p>
            </div>
          </Card>
        ) : null}

        {groups.map((group) => {
          const items = plan.items.filter((i) => i.tier === group);
          if (items.length === 0) return null;

          return (
            <section key={group} className="mb-8">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">
                {group}
              </h2>
              <p className="mb-3 mt-1 text-xs text-ink-400">{TIER_BLURB[group]}</p>

              <div className="space-y-3">
                {items.map((item) => (
                  <Card key={item.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold">{item.name}</h3>
                          <Badge tone={TIER_TONE[group]}>{group}</Badge>
                        </div>
                        <p className="mt-1.5 text-sm text-ink-300">{item.purpose}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{item.dose}</p>
                        <p className="text-xs text-ink-400">{item.timing}</p>
                      </div>
                    </div>

                    {item.evidenceNote ? (
                      <div className="mt-3 rounded-lg border border-ink-700 bg-ink-850 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                          What the evidence says
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-ink-300">
                          {item.evidenceNote}
                        </p>
                      </div>
                    ) : null}

                    {item.monthlyCostCents > 0 ? (
                      <p className="mt-3 text-xs text-ink-400">
                        Roughly {formatMoney(item.monthlyCostCents)}/month
                      </p>
                    ) : null}
                  </Card>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
