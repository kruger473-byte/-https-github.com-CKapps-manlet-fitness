import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { accessContextFor, canAccessContent } from "@/lib/entitlements";
import { signPlayback, formatDuration } from "@/lib/video";
import { VideoPlayer } from "@/components/video-player";
import { Badge, ButtonLink, Card, LockIcon, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ workoutId: string }>;
}): Promise<Metadata> {
  const { workoutId } = await params;
  const workout = await db.workout.findUnique({ where: { id: workoutId } });
  return { title: workout?.title ?? "Workout" };
}

export default async function WorkoutPage({
  params,
}: {
  params: Promise<{ slug: string; workoutId: string }>;
}) {
  const { slug, workoutId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const workout = await db.workout.findUnique({
    where: { id: workoutId },
    include: { program: true, videoAsset: true },
  });
  if (!workout || workout.program.slug !== slug) notFound();

  const { entitlement, accessKeys } = await accessContextFor(user);
  const allowed =
    workout.isFreePreview ||
    canAccessContent(entitlement, accessKeys, {
      type: "PROGRAM",
      id: workout.programId,
      minTier: workout.program.minTier,
    });

  if (!allowed) {
    return (
      <>
        <BackLink slug={slug} title={workout.program.title} />
        <Card className="mt-6 border-volt-500/30 text-center">
          <LockIcon className="mx-auto h-8 w-8 text-volt-500" />
          <h1 className="mt-3 text-lg font-bold">{workout.title}</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-400">
            This session is part of {workout.program.title}, included with the{" "}
            {workout.program.minTier >= 2 ? "Elite" : "Core"} plan.
          </p>
          <ButtonLink href="/account/billing" className="mt-5">
            Unlock it
          </ButtonLink>
        </Card>
      </>
    );
  }

  // Entitlement passed — mint a short-lived playback ticket.
  const ticket = workout.videoAsset
    ? signPlayback({
        provider: workout.videoAsset.provider,
        playbackId: workout.videoAsset.playbackId,
        sourceUrl: workout.videoAsset.sourceUrl,
        thumbnailUrl: workout.videoAsset.thumbnailUrl,
      })
    : null;

  const [progress, siblings] = await Promise.all([
    db.progress.findUnique({
      where: { userId_workoutId: { userId: user.id, workoutId } },
    }),
    db.workout.findMany({
      where: { programId: workout.programId },
      orderBy: { sortOrder: "asc" },
      select: { id: true, title: true, sortOrder: true, durationSec: true },
    }),
  ]);

  const index = siblings.findIndex((w) => w.id === workout.id);
  const prev = index > 0 ? siblings[index - 1] : null;
  const next = index < siblings.length - 1 ? siblings[index + 1] : null;
  const equipment = JSON.parse(workout.equipment) as string[];

  return (
    <>
      <BackLink slug={slug} title={workout.program.title} />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <VideoPlayer
            workoutId={workout.id}
            src={ticket?.url ?? ""}
            poster={ticket?.posterUrl}
            durationSec={workout.durationSec}
            initialSeconds={progress?.secondsWatched ?? 0}
            initiallyCompleted={Boolean(progress?.completedAt)}
          />

          <div className="mt-6">
            <PageHeader
              eyebrow={`Week ${workout.weekNumber} · Day ${workout.dayNumber}`}
              title={workout.title}
              description={workout.description ?? undefined}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge>{formatDuration(workout.durationSec)}</Badge>
            {equipment.map((e) => (
              <Badge key={e}>{e}</Badge>
            ))}
            {workout.isFreePreview ? <Badge tone="volt">Free preview</Badge> : null}
          </div>

          <div className="mt-8 flex justify-between gap-3">
            {prev ? (
              <ButtonLink
                href={`/programs/${slug}/${prev.id}`}
                variant="secondary"
                className="flex-1"
              >
                ← {prev.title}
              </ButtonLink>
            ) : (
              <span className="flex-1" />
            )}
            {next ? (
              <ButtonLink href={`/programs/${slug}/${next.id}`} className="flex-1">
                {next.title} →
              </ButtonLink>
            ) : (
              <span className="flex-1" />
            )}
          </div>
        </div>

        <div>
          <Card>
            <h3 className="mb-3 text-sm font-semibold">{workout.program.title}</h3>
            <ol className="space-y-1">
              {siblings.map((w, i) => (
                <li key={w.id}>
                  <Link
                    href={`/programs/${slug}/${w.id}`}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                      w.id === workout.id
                        ? "bg-volt-500/10 font-medium text-volt-500"
                        : "text-ink-300 hover:bg-ink-800"
                    }`}
                  >
                    <span className="w-5 shrink-0 text-xs tabular-nums text-ink-400">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{w.title}</span>
                    <span className="shrink-0 text-xs text-ink-400">
                      {formatDuration(w.durationSec)}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}

function BackLink({ slug, title }: { slug: string; title: string }) {
  return (
    <Link
      href={`/programs/${slug}`}
      className="inline-block text-sm text-ink-400 hover:text-ink-100"
    >
      ← {title}
    </Link>
  );
}
