import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { entitlementFor, formatMoney, tierLabel } from "@/lib/entitlements";
import { formatDuration } from "@/lib/video";
import {
  Alert,
  Badge,
  ButtonLink,
  Card,
  LockBadge,
  PageHeader,
  ProgressBar,
  Stat,
  ArrowRightIcon,
  CalendarIcon,
  PlayIcon,
} from "@/components/ui";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const entitlement = entitlementFor(user.subscriptions);

  const [programs, recentProgress, upcomingSession, latestThreads, plans] =
    await Promise.all([
      db.program.findMany({
        where: { isPublished: true },
        orderBy: { sortOrder: "asc" },
        include: { _count: { select: { workouts: true } } },
        take: 4,
      }),
      db.progress.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
        take: 3,
        include: { workout: { include: { program: true } } },
      }),
      db.coachingSession.findFirst({
        where: { clientId: user.id, status: "SCHEDULED", startsAt: { gte: new Date() } },
        orderBy: { startsAt: "asc" },
        include: { coach: { include: { user: true } } },
      }),
      db.thread.findMany({
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        take: 4,
        include: { author: true, _count: { select: { posts: true } } },
      }),
      db.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    ]);

  const completedCount = await db.progress.count({
    where: { userId: user.id, completedAt: { not: null } },
  });
  const totalWorkouts = await db.workout.count();
  const upgradeTarget = plans.find((p) => p.tier > entitlement.tier);

  return (
    <>
      <PageHeader
        eyebrow={`${entitlement.planName} member`}
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        description="Pick up where you left off, or start something new."
        action={
          entitlement.tier === 0 && upgradeTarget ? (
            <ButtonLink href="/account/billing">
              Start {upgradeTarget.trialDays}-day trial
            </ButtonLink>
          ) : null
        }
      />

      {entitlement.inGracePeriod ? (
        <div className="mb-6">
          <Alert tone="danger">
            Your last payment failed. You still have full access while we retry — update
            your card in{" "}
            <Link href="/account/billing" className="font-medium underline">
              billing
            </Link>{" "}
            to avoid losing it.
          </Alert>
        </div>
      ) : null}

      {entitlement.isTrialing && entitlement.currentPeriodEnd ? (
        <div className="mb-6">
          <Alert tone="info">
            You&apos;re on a free trial until{" "}
            {entitlement.currentPeriodEnd.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
            })}
            . Cancel any time before then and you won&apos;t be charged.
          </Alert>
        </div>
      ) : null}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Workouts done"
          value={String(completedCount)}
          sub={`of ${totalWorkouts} in the library`}
        />
        <Stat label="Your plan" value={entitlement.planName} sub={tierLabel(entitlement.tier)} />
        <Stat
          label="Coaching credits"
          value={String(entitlement.coachingCreditsLeft)}
          sub={entitlement.includesCoaching ? "resets monthly" : "Elite plan only"}
        />
        <Stat
          label="Renews"
          value={
            entitlement.currentPeriodEnd
              ? entitlement.currentPeriodEnd.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })
              : "—"
          }
          sub={entitlement.cancelAtPeriodEnd ? "cancels at period end" : "auto-renews"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Continue training */}
          <section>
            <SectionHead title="Continue training" href="/programs" linkLabel="All programs" />
            {recentProgress.length > 0 ? (
              <div className="space-y-3">
                {recentProgress.map((p) => (
                  <Link
                    key={p.id}
                    href={`/programs/${p.workout.program.slug}/${p.workout.id}`}
                    className="card flex items-center gap-4 p-4 transition-colors hover:border-volt-500/40"
                  >
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-volt-500/10 text-volt-500">
                      <PlayIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.workout.title}</p>
                      <p className="truncate text-xs text-ink-400">
                        {p.workout.program.title}
                      </p>
                      <div className="mt-2">
                        <ProgressBar
                          value={p.secondsWatched}
                          max={p.workout.durationSec || 1}
                        />
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-ink-400">
                      {p.completedAt ? "Done" : formatDuration(p.workout.durationSec)}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {programs.map((program) => {
                  const locked = entitlement.tier < program.minTier;
                  return (
                    <Link
                      key={program.id}
                      href={`/programs/${program.slug}`}
                      className="card p-4 transition-colors hover:border-volt-500/40"
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold">{program.title}</h3>
                        {locked ? <LockBadge tier={program.minTier} /> : null}
                      </div>
                      <p className="line-clamp-2 text-xs text-ink-400">
                        {program.subtitle}
                      </p>
                      <p className="mt-3 text-xs text-ink-400">
                        {program._count.workouts} sessions · {program.weeks} weeks ·{" "}
                        {program.level}
                      </p>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* Exchange */}
          <section>
            <SectionHead title="From the exchange" href="/exchange" linkLabel="Open" />
            <div className="space-y-3">
              {latestThreads.map((t) => (
                <Link
                  key={t.id}
                  href={`/exchange/${t.slug}`}
                  className="card block p-4 transition-colors hover:border-volt-500/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-medium">{t.title}</h3>
                    {t.isPinned ? <Badge tone="volt">Pinned</Badge> : null}
                  </div>
                  <p className="mt-1.5 text-xs text-ink-400">
                    {t.author.name} · {t._count.posts} repl
                    {t._count.posts === 1 ? "y" : "ies"}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        </div>

        {/* Right rail */}
        <div className="space-y-6">
          <Card>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <CalendarIcon className="h-4 w-4 text-volt-500" />
              Next coaching call
            </h3>
            {upcomingSession ? (
              <>
                <p className="text-sm font-medium">{upcomingSession.coach.user.name}</p>
                <p className="mt-1 text-xs text-ink-400">
                  {upcomingSession.startsAt.toLocaleString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                {upcomingSession.agenda ? (
                  <p className="mt-3 text-xs text-ink-300">{upcomingSession.agenda}</p>
                ) : null}
                <ButtonLink
                  href={`/coaching/room/${upcomingSession.roomCode}`}
                  className="mt-4 w-full"
                >
                  Enter classroom
                </ButtonLink>
              </>
            ) : (
              <>
                <p className="text-xs text-ink-400">
                  {entitlement.includesCoaching
                    ? "You have credits available. Book a slot with your coach."
                    : "1-1 coaching is part of the Elite plan, or bookable as a one-off."}
                </p>
                <ButtonLink href="/coaching" variant="secondary" className="mt-4 w-full">
                  Book a session
                </ButtonLink>
              </>
            )}
          </Card>

          {upgradeTarget ? (
            <Card className="border-volt-500/30">
              <h3 className="text-sm font-semibold">Unlock {upgradeTarget.name}</h3>
              <p className="mt-1.5 text-xs text-ink-400">{upgradeTarget.tagline}</p>
              <ul className="mt-3 space-y-1.5 text-xs text-ink-300">
                {(JSON.parse(upgradeTarget.features) as string[]).slice(0, 4).map((f) => (
                  <li key={f}>· {f}</li>
                ))}
              </ul>
              <p className="mt-3 text-sm font-bold">
                {formatMoney(upgradeTarget.priceMonthlyCents)}
                <span className="text-xs font-normal text-ink-400">/month</span>
              </p>
              <ButtonLink href="/account/billing" className="mt-4 w-full">
                Upgrade
              </ButtonLink>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

function SectionHead({
  title,
  href,
  linkLabel,
}: {
  title: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-base font-semibold">{title}</h2>
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-xs font-medium text-volt-500 hover:underline"
      >
        {linkLabel}
        <ArrowRightIcon className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
