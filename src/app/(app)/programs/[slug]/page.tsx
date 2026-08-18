import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { accessContextFor, canAccessContent } from "@/lib/entitlements";
import { formatDuration } from "@/lib/video";
import {
  PageHeader,
  Badge,
  ButtonLink,
  Card,
  LockBadge,
  CheckIcon,
  PlayIcon,
  LockIcon,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const program = await db.program.findUnique({ where: { slug } });
  return { title: program?.title ?? "Program" };
}

export default async function ProgramDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { entitlement, accessKeys } = await accessContextFor(user);

  const program = await db.program.findUnique({
    where: { slug },
    include: {
      workouts: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!program || !program.isPublished) notFound();

  const programLocked = !canAccessContent(entitlement, accessKeys, {
    type: "PROGRAM",
    id: program.id,
    minTier: program.minTier,
  });

  const progress = await db.progress.findMany({
    where: { userId: user.id, workout: { programId: program.id } },
  });
  const progressByWorkout = new Map(progress.map((p) => [p.workoutId, p]));

  const byWeek = new Map<number, typeof program.workouts>();
  for (const w of program.workouts) {
    const list = byWeek.get(w.weekNumber) ?? [];
    list.push(w);
    byWeek.set(w.weekNumber, list);
  }

  const doneCount = program.workouts.filter(
    (w) => progressByWorkout.get(w.id)?.completedAt,
  ).length;

  return (
    <>
      <Link
        href="/programs"
        className="mb-6 inline-block text-sm text-ink-400 hover:text-ink-100"
      >
        ← All programs
      </Link>

      <PageHeader
        eyebrow={`${program.level} · ${program.weeks} weeks`}
        title={program.title}
        description={program.description}
        action={programLocked ? <LockBadge tier={program.minTier} /> : null}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {programLocked ? (
            <Card className="border-volt-500/30 text-center">
              <LockIcon className="mx-auto h-8 w-8 text-volt-500" />
              <h3 className="mt-3 text-base font-semibold">
                This program needs the {program.minTier >= 2 ? "Elite" : "Core"} plan
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-ink-400">
                You can still watch the free preview session below to see how it&apos;s
                coached.
              </p>
              <ButtonLink href="/account/billing" className="mt-4">
                Unlock the full program
              </ButtonLink>
            </Card>
          ) : null}

          <div className={programLocked ? "mt-6 space-y-6" : "space-y-6"}>
            {[...byWeek.entries()].map(([week, workouts]) => (
              <section key={week}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-400">
                  Week {week}
                </h2>
                <div className="space-y-2">
                  {workouts.map((w) => {
                    const p = progressByWorkout.get(w.id);
                    const canWatch = !programLocked || w.isFreePreview;
                    const content = (
                      <>
                        <div
                          className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
                            p?.completedAt
                              ? "bg-emerald-500/15 text-emerald-300"
                              : canWatch
                                ? "bg-volt-500/10 text-volt-500"
                                : "bg-ink-800 text-ink-400"
                          }`}
                        >
                          {p?.completedAt ? (
                            <CheckIcon className="h-4 w-4" />
                          ) : canWatch ? (
                            <PlayIcon className="h-4 w-4" />
                          ) : (
                            <LockIcon className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{w.title}</p>
                          <p className="text-xs text-ink-400">
                            Day {w.dayNumber} · {formatDuration(w.durationSec)}
                            {w.isFreePreview && programLocked ? " · free preview" : ""}
                          </p>
                        </div>
                        {p?.completedAt ? (
                          <Badge tone="success">Done</Badge>
                        ) : p?.secondsWatched ? (
                          <Badge tone="info">In progress</Badge>
                        ) : null}
                      </>
                    );

                    return canWatch ? (
                      <Link
                        key={w.id}
                        href={`/programs/${program.slug}/${w.id}`}
                        className="card flex items-center gap-3 p-3.5 transition-colors hover:border-volt-500/40"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div
                        key={w.id}
                        className="card flex items-center gap-3 p-3.5 opacity-60"
                      >
                        {content}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <h3 className="text-sm font-semibold">Your progress</h3>
            <p className="mt-3 text-3xl font-bold tabular-nums text-volt-500">
              {doneCount}
              <span className="text-base font-normal text-ink-400">
                {" "}
                / {program.workouts.length}
              </span>
            </p>
            <p className="mt-1 text-xs text-ink-400">sessions completed</p>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold">Equipment</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                ...new Set(
                  program.workouts.flatMap(
                    (w) => JSON.parse(w.equipment) as string[],
                  ),
                ),
              ].map((e) => (
                <Badge key={e}>{e}</Badge>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
