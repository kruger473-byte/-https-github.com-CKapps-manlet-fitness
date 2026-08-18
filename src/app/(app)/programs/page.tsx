import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { accessContextFor, canAccessContent, accessReason } from "@/lib/entitlements";
import { PageHeader, LockBadge, Badge, ButtonLink } from "@/components/ui";

export const metadata: Metadata = { title: "Programs" };
export const dynamic = "force-dynamic";

export default async function ProgramsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { entitlement, accessKeys } = await accessContextFor(user);

  const programs = await db.program.findMany({
    where: { isPublished: true },
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { workouts: true } },
      workouts: {
        select: { id: true, durationSec: true },
      },
    },
  });

  const completed = await db.progress.findMany({
    where: { userId: user.id, completedAt: { not: null } },
    select: { workoutId: true },
  });
  const doneIds = new Set(completed.map((c) => c.workoutId));

  return (
    <>
      <PageHeader
        eyebrow="Train"
        title="Programs"
        description="Structured blocks, not a loose video library. Start at week one and follow it."
      />

      <div className="grid gap-5 md:grid-cols-2">
        {programs.map((program) => {
          const reason = accessReason(entitlement, accessKeys, {
            type: "PROGRAM",
            id: program.id,
            minTier: program.minTier,
          });
          const locked = reason === "locked";
          const totalMinutes = Math.round(
            program.workouts.reduce((n, w) => n + w.durationSec, 0) / 60,
          );
          const doneCount = program.workouts.filter((w) => doneIds.has(w.id)).length;

          return (
            <div key={program.id} className="card flex flex-col overflow-hidden p-0">
              <div
                className="relative h-36 border-b border-ink-800"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(200,243,29,0.16) 0%, rgba(13,15,20,1) 65%)",
                }}
              >
                <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">{program.title}</h2>
                    <p className="text-xs text-ink-300">{program.subtitle}</p>
                  </div>
                  {locked ? (
                    <LockBadge tier={program.minTier} />
                  ) : reason === "purchased" ? (
                    <Badge tone="success">Purchased</Badge>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-1 flex-col p-5">
                <p className="flex-1 text-sm leading-relaxed text-ink-400">
                  {program.description}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge>{program.level}</Badge>
                  <Badge>{program.weeks} weeks</Badge>
                  <Badge>{program._count.workouts} sessions</Badge>
                  <Badge>~{totalMinutes} min total</Badge>
                </div>

                {doneCount > 0 ? (
                  <p className="mt-3 text-xs text-volt-500">
                    {doneCount} of {program._count.workouts} sessions done
                  </p>
                ) : null}

                <div className="mt-5">
                  {locked ? (
                    <ButtonLink
                      href="/account/billing"
                      variant="secondary"
                      className="w-full"
                    >
                      Unlock with {program.minTier >= 2 ? "Elite" : "Core"}
                    </ButtonLink>
                  ) : (
                    <ButtonLink href={`/programs/${program.slug}`} className="w-full">
                      {doneCount > 0 ? "Continue program" : "Start program"}
                    </ButtonLink>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {entitlement.tier === 0 ? (
        <div className="mt-8 card border-volt-500/30 p-6 text-center">
          <h3 className="text-base font-semibold">
            Free accounts get the first session of every program
          </h3>
          <p className="mx-auto mt-2 max-w-lg text-sm text-ink-400">
            Enough to judge whether the coaching style works for you. Core unlocks every
            session, every plan and the full knowledge base.
          </p>
          <ButtonLink href="/account/billing" className="mt-4">
            See plans
          </ButtonLink>
        </div>
      ) : null}
    </>
  );
}
