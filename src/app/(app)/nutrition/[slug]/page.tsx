import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { entitlementFor } from "@/lib/entitlements";
import { PageHeader, Badge, ButtonLink, Card, LockIcon } from "@/components/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const plan = await db.dietPlan.findUnique({ where: { slug } });
  return { title: plan?.title ?? "Diet plan" };
}

const SLOT_ORDER = ["breakfast", "lunch", "snack", "dinner"];

export default async function DietPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ day?: string }>;
}) {
  const [{ slug }, { day }] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const plan = await db.dietPlan.findUnique({
    where: { slug },
    include: { meals: { orderBy: [{ dayNumber: "asc" }, { sortOrder: "asc" }] } },
  });
  if (!plan || !plan.isPublished) notFound();

  const entitlement = entitlementFor(user.subscriptions);
  if (entitlement.tier < plan.minTier) {
    return (
      <>
        <Link href="/nutrition" className="text-sm text-ink-400 hover:text-ink-100">
          ← Nutrition
        </Link>
        <Card className="mt-6 border-volt-500/30 text-center">
          <LockIcon className="mx-auto h-8 w-8 text-volt-500" />
          <h1 className="mt-3 text-lg font-bold">{plan.title}</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-400">
            {plan.description}
          </p>
          <ButtonLink href="/account/billing" className="mt-5">
            Unlock with Core
          </ButtonLink>
        </Card>
      </>
    );
  }

  const activeDay = Math.min(
    Math.max(1, Number(day ?? "1") || 1),
    plan.durationDays,
  );
  const dayMeals = plan.meals
    .filter((m) => m.dayNumber === activeDay)
    .sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));

  const dayTotals = dayMeals.reduce(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      protein: acc.protein + m.proteinG,
      carbs: acc.carbs + m.carbsG,
      fat: acc.fat + m.fatG,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  // Aggregate every ingredient across the week into one shopping list.
  const shoppingList = [
    ...new Set(
      plan.meals.flatMap((m) => JSON.parse(m.ingredients) as string[]),
    ),
  ];

  return (
    <>
      <Link href="/nutrition" className="text-sm text-ink-400 hover:text-ink-100">
        ← Nutrition
      </Link>

      <div className="mt-4">
        <PageHeader
          eyebrow={plan.goal}
          title={plan.title}
          description={plan.description}
        />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Target label="Daily target" value={`${plan.kcalTarget} kcal`} />
        <Target label="Protein" value={`${plan.proteinG}g`} />
        <Target label="Carbs" value={`${plan.carbsG}g`} />
        <Target label="Fat" value={`${plan.fatG}g`} />
      </div>

      {/* Day switcher */}
      <div className="mb-6 flex flex-wrap gap-2">
        {Array.from({ length: plan.durationDays }, (_, i) => i + 1).map((d) => (
          <Link
            key={d}
            href={`/nutrition/${plan.slug}?day=${d}`}
            className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors ${
              d === activeDay
                ? "border-volt-500 bg-volt-500 text-[var(--color-accent-fg)]"
                : "border-ink-700 bg-ink-850 text-ink-300 hover:border-ink-600"
            }`}
          >
            Day {d}
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {dayMeals.map((meal) => (
            <Card key={meal.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge tone="volt">{meal.slot}</Badge>
                  <h3 className="mt-2 text-base font-semibold">{meal.title}</h3>
                </div>
                <p className="shrink-0 text-sm font-bold tabular-nums">
                  {meal.kcal} <span className="text-xs font-normal text-ink-400">kcal</span>
                </p>
              </div>

              {meal.method ? (
                <p className="mt-3 text-sm text-ink-400">{meal.method}</p>
              ) : null}

              <div className="mt-4 flex gap-4 text-xs text-ink-400">
                <span>P {meal.proteinG}g</span>
                <span>C {meal.carbsG}g</span>
                <span>F {meal.fatG}g</span>
              </div>
            </Card>
          ))}

          <Card className="border-volt-500/30">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Day {activeDay} total</h3>
              <div className="flex gap-4 text-sm tabular-nums">
                <span className="font-bold text-volt-500">{dayTotals.kcal} kcal</span>
                <span className="text-ink-400">P {dayTotals.protein}g</span>
                <span className="text-ink-400">C {dayTotals.carbs}g</span>
                <span className="text-ink-400">F {dayTotals.fat}g</span>
              </div>
            </div>
            <p className="mt-2 text-xs text-ink-400">
              Target is {plan.kcalTarget} kcal — you are{" "}
              {Math.abs(dayTotals.kcal - plan.kcalTarget)} kcal{" "}
              {dayTotals.kcal >= plan.kcalTarget ? "over" : "under"}. Anything within
              about 100 kcal is noise.
            </p>
          </Card>
        </div>

        <div>
          <Card>
            <h3 className="text-sm font-semibold">Shopping list</h3>
            <p className="mt-1 text-xs text-ink-400">
              Everything this plan uses across {plan.durationDays} days.
            </p>
            <ul className="mt-3 space-y-2">
              {shoppingList.map((item) => (
                <li key={item} className="flex gap-2 text-sm text-ink-300">
                  <span className="text-ink-600">□</span>
                  {item}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

function Target({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3.5">
      <p className="text-[10px] uppercase tracking-wider text-ink-400">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}
