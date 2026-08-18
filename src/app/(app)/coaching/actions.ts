"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { entitlementFor } from "@/lib/entitlements";

export type BookingState = { error?: string; ok?: boolean };

const bookSchema = z.object({
  slotId: z.string().min(1),
  agenda: z.string().trim().max(500).optional(),
  goals: z.string().trim().max(500).optional(),
});

/**
 * Book an availability slot.
 *
 * The slot is claimed with a conditional update (`isBooked: false` in the
 * where clause) so two members hitting the same slot at once cannot both
 * win — the second update matches zero rows and is rejected.
 */
export async function bookSlotAction(
  _prev: BookingState,
  formData: FormData,
): Promise<BookingState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to book a session." };

  const parsed = bookSchema.safeParse({
    slotId: formData.get("slotId"),
    agenda: formData.get("agenda") ?? undefined,
    goals: formData.get("goals") ?? undefined,
  });
  if (!parsed.success) return { error: "Pick a slot and try again." };

  const entitlement = entitlementFor(user.subscriptions);
  const activeSub = user.subscriptions.find(
    (s) => s.plan.tier === entitlement.tier && s.coachingCreditsLeft > 0,
  );
  const hasCredit = entitlement.includesCoaching && Boolean(activeSub);

  if (!hasCredit) {
    return {
      error:
        "You have no coaching credits left. Elite includes credits each month, or you can buy a one-off session.",
    };
  }

  const slot = await db.availabilitySlot.findUnique({
    where: { id: parsed.data.slotId },
  });
  if (!slot || slot.isBooked) {
    return { error: "That slot was just taken. Pick another one." };
  }
  if (slot.startsAt < new Date()) {
    return { error: "That slot is in the past." };
  }

  // Claim the slot atomically.
  const claimed = await db.availabilitySlot.updateMany({
    where: { id: slot.id, isBooked: false },
    data: { isBooked: true },
  });
  if (claimed.count === 0) {
    return { error: "That slot was just taken. Pick another one." };
  }

  let roomCode = "";
  try {
    const session = await db.coachingSession.create({
      data: {
        coachId: slot.coachId,
        clientId: user.id,
        slotId: slot.id,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        roomCode: `room-${randomBytes(6).toString("hex")}`,
        agenda: parsed.data.agenda || null,
        clientGoals: parsed.data.goals || null,
        paidWithCredit: true,
      },
    });
    roomCode = session.roomCode;

    if (activeSub) {
      await db.subscription.update({
        where: { id: activeSub.id },
        data: { coachingCreditsLeft: { decrement: 1 } },
      });
    }
  } catch {
    // Release the slot so a failed booking doesn't strand it.
    await db.availabilitySlot.update({
      where: { id: slot.id },
      data: { isBooked: false },
    });
    return { error: "Booking failed. Please try again." };
  }

  revalidatePath("/coaching");
  redirect(`/coaching/room/${roomCode}`);
}

const messageSchema = z.object({
  sessionId: z.string().min(1),
  body: z.string().trim().min(1, "Write something first.").max(4000),
});

export async function postClassroomMessageAction(
  _prev: BookingState,
  formData: FormData,
): Promise<BookingState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };

  const parsed = messageSchema.safeParse({
    sessionId: formData.get("sessionId"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Message could not be sent." };
  }

  const session = await db.coachingSession.findUnique({
    where: { id: parsed.data.sessionId },
    include: { coach: true },
  });
  if (!session) return { error: "Session not found." };

  const isParticipant =
    session.clientId === user.id || session.coach.userId === user.id;
  if (!isParticipant) return { error: "This isn't your classroom." };

  await db.classroomMessage.create({
    data: {
      sessionId: session.id,
      authorId: user.id,
      body: parsed.data.body,
    },
  });

  revalidatePath(`/coaching/room/${session.roomCode}`);
  return { ok: true };
}

const notesSchema = z.object({
  sessionId: z.string().min(1),
  notes: z.string().trim().max(8000),
});

/** Coach-only session notes. */
export async function saveCoachNotesAction(
  _prev: BookingState,
  formData: FormData,
): Promise<BookingState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };

  const parsed = notesSchema.safeParse({
    sessionId: formData.get("sessionId"),
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return { error: "Notes could not be saved." };

  const session = await db.coachingSession.findUnique({
    where: { id: parsed.data.sessionId },
    include: { coach: true },
  });
  if (!session) return { error: "Session not found." };
  if (session.coach.userId !== user.id) {
    return { error: "Only the coach can write session notes." };
  }

  await db.coachingSession.update({
    where: { id: session.id },
    data: { coachNotes: parsed.data.notes },
  });

  revalidatePath(`/coaching/room/${session.roomCode}`);
  return { ok: true };
}
