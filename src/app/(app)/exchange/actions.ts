"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { entitlementFor } from "@/lib/entitlements";

export type ExchangeState = { error?: string; ok?: boolean };

/** Posting is a paid feature; reading is not. */
const POST_MIN_TIER = 1;

const threadSchema = z.object({
  title: z.string().trim().min(8, "Give it a title people can search for.").max(140),
  body: z.string().trim().min(20, "Add a bit more detail.").max(8000),
  categoryId: z.string().optional(),
});

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export async function createThreadAction(
  _prev: ExchangeState,
  formData: FormData,
): Promise<ExchangeState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };

  const entitlement = entitlementFor(user.subscriptions);
  if (entitlement.tier < POST_MIN_TIER) {
    return { error: "Posting is for Core and Elite members. Reading stays free." };
  }

  const parsed = threadSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    categoryId: formData.get("categoryId") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  // Slugs must be unique; append a short suffix if the base is taken.
  const base = slugify(parsed.data.title);
  let slug = base;
  if (await db.thread.findUnique({ where: { slug } })) {
    slug = `${base}-${Date.now().toString(36).slice(-4)}`;
  }

  await db.thread.create({
    data: {
      slug,
      title: parsed.data.title,
      body: parsed.data.body,
      authorId: user.id,
      categoryId: parsed.data.categoryId ?? null,
    },
  });

  revalidatePath("/exchange");
  redirect(`/exchange/${slug}`);
}

const replySchema = z.object({
  threadId: z.string().min(1),
  body: z.string().trim().min(2, "Write a reply first.").max(8000),
});

export async function createReplyAction(
  _prev: ExchangeState,
  formData: FormData,
): Promise<ExchangeState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };

  const entitlement = entitlementFor(user.subscriptions);
  if (entitlement.tier < POST_MIN_TIER) {
    return { error: "Replying is for Core and Elite members." };
  }

  const parsed = replySchema.safeParse({
    threadId: formData.get("threadId"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const thread = await db.thread.findUnique({ where: { id: parsed.data.threadId } });
  if (!thread) return { error: "Thread not found." };
  if (thread.isLocked) return { error: "This thread is locked." };

  await db.post.create({
    data: {
      threadId: thread.id,
      authorId: user.id,
      body: parsed.data.body,
      // Coach and admin replies are marked so members can spot the answer.
      isCoachAnswer: user.role === "COACH" || user.role === "ADMIN",
    },
  });

  revalidatePath(`/exchange/${thread.slug}`);
  return { ok: true };
}

export async function toggleReactionAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const postId = formData.get("postId");
  const threadId = formData.get("threadId");
  if (typeof postId !== "string" && typeof threadId !== "string") return;

  // The compound unique includes nullable columns, which Prisma won't accept
  // in a findUnique lookup — the DB constraint still guarantees uniqueness.
  const existing = await db.reaction.findFirst({
    where: {
      userId: user.id,
      threadId: typeof threadId === "string" ? threadId : null,
      postId: typeof postId === "string" ? postId : null,
    },
  });
  if (existing) {
    await db.reaction.delete({ where: { id: existing.id } });
  } else {
    await db.reaction.create({
      data: {
        userId: user.id,
        threadId: typeof threadId === "string" ? threadId : null,
        postId: typeof postId === "string" ? postId : null,
      },
    });
  }

  const slug = formData.get("slug");
  if (typeof slug === "string") revalidatePath(`/exchange/${slug}`);
}
