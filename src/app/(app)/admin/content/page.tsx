import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge, ButtonLink, ArrowRightIcon } from "@/components/ui";

export const metadata: Metadata = { title: "Content" };
export const dynamic = "force-dynamic";

export default async function ContentHubPage() {
  const [programs, workouts, dietPlans, meals, supplements, articles, drafts] =
    await Promise.all([
      db.program.count(),
      db.workout.count(),
      db.dietPlan.count(),
      db.meal.count(),
      db.supplementPlan.count(),
      db.article.count(),
      Promise.all([
        db.program.count({ where: { isPublished: false } }),
        db.dietPlan.count({ where: { isPublished: false } }),
        db.supplementPlan.count({ where: { isPublished: false } }),
        db.article.count({ where: { isPublished: false } }),
      ]),
    ]);

  const draftTotal = drafts.reduce((a, b) => a + b, 0);

  const sections = [
    {
      href: "/admin/content/programs",
      title: "Training programs",
      blurb: "Multi-week blocks and the video sessions inside them.",
      count: `${programs} programs · ${workouts} sessions`,
    },
    {
      href: "/admin/content/nutrition",
      title: "Diet plans",
      blurb: "Day-by-day meal plans with macros and shopping lists.",
      count: `${dietPlans} plans · ${meals} meals`,
    },
    {
      href: "/admin/content/supplements",
      title: "Supplement plans",
      blurb: "Stacks graded core, optional and situational, with evidence notes.",
      count: `${supplements} plans`,
    },
    {
      href: "/admin/content/articles",
      title: "Knowledge base",
      blurb: "Written guides. Free ones feed search; deeper ones sit behind the plan.",
      count: `${articles} articles`,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Creator console"
        title="Content"
        description="Everything members can read, watch and follow. Add or change any of it here — nothing needs a developer."
        action={
          <ButtonLink href="/admin/pricing" variant="secondary">
            Pricing & products
          </ButtonLink>
        }
      />

      {draftTotal > 0 ? (
        <p className="mb-6 text-sm text-ink-400">
          You have <span className="font-medium text-ink-100">{draftTotal}</span> unpublished
          draft{draftTotal === 1 ? "" : "s"}. Drafts are invisible to members until you
          set them live.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="card group flex flex-col p-6 transition-colors hover:border-volt-500/40"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold">{s.title}</h2>
              <Badge>{s.count}</Badge>
            </div>
            <p className="mt-2 flex-1 text-sm text-ink-400">{s.blurb}</p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-volt-500">
              Manage
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>

      <Card className="mt-6">
        <h2 className="text-sm font-semibold">How access works</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-400">
          Every item has a &ldquo;who can see this&rdquo; setting: everyone, Core and
          above, or Elite only. Separately, you can sell any item on its own from{" "}
          <Link href="/admin/pricing" className="text-volt-500 hover:underline">
            Pricing &amp; products
          </Link>{" "}
          — someone who buys it gets access whatever plan they&apos;re on, and keeps it
          if they cancel.
        </p>
      </Card>
    </>
  );
}
