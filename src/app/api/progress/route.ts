import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { accessContextFor, canAccessContent } from "@/lib/entitlements";

const schema = z.object({
  workoutId: z.string().min(1),
  secondsWatched: z.number().int().min(0),
  completed: z.boolean(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const { workoutId, secondsWatched, completed } = parsed.data;

  // Re-check entitlement here: the player is client-side and this endpoint
  // must not become a way to record progress on content you cannot access.
  const workout = await db.workout.findUnique({
    where: { id: workoutId },
    include: { program: true },
  });
  if (!workout) {
    return NextResponse.json({ error: "Workout not found" }, { status: 404 });
  }

  const { entitlement, accessKeys } = await accessContextFor(user);
  const allowed =
    workout.isFreePreview ||
    canAccessContent(entitlement, accessKeys, {
      type: "PROGRAM",
      id: workout.programId,
      minTier: workout.program.minTier,
    });
  if (!allowed) {
    return NextResponse.json({ error: "Not included in your plan" }, { status: 403 });
  }

  const existing = await db.progress.findUnique({
    where: { userId_workoutId: { userId: user.id, workoutId } },
  });

  const progress = await db.progress.upsert({
    where: { userId_workoutId: { userId: user.id, workoutId } },
    // Never move progress backwards — a rewatch shouldn't erase a completion.
    update: {
      secondsWatched: Math.max(existing?.secondsWatched ?? 0, secondsWatched),
      completedAt: completed ? (existing?.completedAt ?? new Date()) : existing?.completedAt,
    },
    create: {
      userId: user.id,
      workoutId,
      secondsWatched,
      completedAt: completed ? new Date() : null,
    },
  });

  return NextResponse.json({
    ok: true,
    secondsWatched: progress.secondsWatched,
    completed: Boolean(progress.completedAt),
  });
}
