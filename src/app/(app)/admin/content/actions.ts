"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export type ContentState = { error?: string; notice?: string };

async function requireAdmin() {
  const user = await getCurrentUser();
  return user && user.role === "ADMIN" ? user : null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/**
 * Slugs are part of public URLs, so they must be unique. Rather than failing a
 * save on a collision, append a short suffix — losing a nice slug is a smaller
 * problem than losing the content someone just typed.
 */
async function uniqueSlug(
  desired: string,
  exists: (slug: string) => Promise<boolean>,
  currentId?: string,
): Promise<string> {
  const base = slugify(desired) || `item-${Date.now().toString(36)}`;
  if (!(await exists(base))) return base;
  for (let i = 2; i < 50; i++) {
    const candidate = `${base}-${i}`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${base}-${Date.now().toString(36).slice(-4)}`;
}

const num = (v: FormDataEntryValue | null, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const bool = (v: FormDataEntryValue | null) => v === "on" || v === "true";
const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();

/* ========================================================================== */
/* Programs                                                                   */
/* ========================================================================== */

const programSchema = z.object({
  title: z.string().trim().min(2, "Give the program a title.").max(120),
  subtitle: z.string().trim().max(160).optional(),
  description: z.string().trim().min(10, "Add a description.").max(4000),
  level: z.string().trim().max(40),
  category: z.string().trim().max(40),
  weeks: z.number().int().min(1).max(104),
  minTier: z.number().int().min(0).max(2),
});

export async function saveProgramAction(
  _prev: ContentState,
  formData: FormData,
): Promise<ContentState> {
  if (!(await requireAdmin())) return { error: "Admins only." };

  const id = str(formData.get("id"));
  const parsed = programSchema.safeParse({
    title: formData.get("title"),
    subtitle: str(formData.get("subtitle")) || undefined,
    description: formData.get("description"),
    level: str(formData.get("level")) || "beginner",
    category: str(formData.get("category")) || "strength",
    weeks: num(formData.get("weeks"), 4),
    minTier: num(formData.get("minTier"), 1),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const data = {
    title: parsed.data.title,
    subtitle: parsed.data.subtitle ?? null,
    description: parsed.data.description,
    level: parsed.data.level,
    category: parsed.data.category,
    weeks: parsed.data.weeks,
    minTier: parsed.data.minTier,
    isPublished: bool(formData.get("isPublished")),
    sortOrder: num(formData.get("sortOrder")),
    coverUrl: str(formData.get("coverUrl")) || null,
  };

  if (id) {
    await db.program.update({ where: { id }, data });
    revalidatePath("/admin/content/programs");
    revalidatePath("/programs");
    return { notice: "Program saved." };
  }

  const slug = await uniqueSlug(parsed.data.title, async (s) =>
    Boolean(await db.program.findUnique({ where: { slug: s } })),
  );
  const created = await db.program.create({ data: { ...data, slug } });
  revalidatePath("/admin/content/programs");
  revalidatePath("/programs");
  redirect(`/admin/content/programs/${created.id}`);
}

const workoutSchema = z.object({
  programId: z.string().min(1),
  title: z.string().trim().min(2, "Give the session a title.").max(120),
  description: z.string().trim().max(2000).optional(),
  weekNumber: z.number().int().min(1).max(104),
  dayNumber: z.number().int().min(1).max(14),
  durationSec: z.number().int().min(0).max(60 * 60 * 6),
});

export async function saveWorkoutAction(
  _prev: ContentState,
  formData: FormData,
): Promise<ContentState> {
  if (!(await requireAdmin())) return { error: "Admins only." };

  const id = str(formData.get("id"));
  const parsed = workoutSchema.safeParse({
    programId: formData.get("programId"),
    title: formData.get("title"),
    description: str(formData.get("description")) || undefined,
    weekNumber: num(formData.get("weekNumber"), 1),
    dayNumber: num(formData.get("dayNumber"), 1),
    durationSec: num(formData.get("durationSec")),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const equipment = str(formData.get("equipment"))
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  const videoUrl = str(formData.get("videoUrl"));
  const videoProvider = str(formData.get("videoProvider")) || "local";
  const playbackId = str(formData.get("playbackId"));

  // The video asset is managed alongside the workout: one form for the coach,
  // two rows underneath.
  let videoAssetId: string | null = null;
  const existing = id
    ? await db.workout.findUnique({ where: { id }, include: { videoAsset: true } })
    : null;

  if (videoUrl || playbackId) {
    const assetData = {
      provider: videoProvider,
      sourceUrl: videoUrl || null,
      playbackId: playbackId || null,
      durationSec: parsed.data.durationSec,
      status: "ready",
    };
    if (existing?.videoAsset) {
      await db.videoAsset.update({ where: { id: existing.videoAsset.id }, data: assetData });
      videoAssetId = existing.videoAsset.id;
    } else {
      const asset = await db.videoAsset.create({ data: assetData });
      videoAssetId = asset.id;
    }
  } else if (existing?.videoAssetId) {
    videoAssetId = existing.videoAssetId;
  }

  const data = {
    programId: parsed.data.programId,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    weekNumber: parsed.data.weekNumber,
    dayNumber: parsed.data.dayNumber,
    durationSec: parsed.data.durationSec,
    equipment: JSON.stringify(equipment),
    sortOrder: num(formData.get("sortOrder")),
    isFreePreview: bool(formData.get("isFreePreview")),
    videoAssetId,
  };

  if (id) {
    await db.workout.update({ where: { id }, data });
  } else {
    await db.workout.create({ data });
  }

  revalidatePath(`/admin/content/programs/${parsed.data.programId}`);
  revalidatePath("/programs");
  return { notice: id ? "Session saved." : "Session added." };
}

export async function deleteWorkoutAction(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const id = str(formData.get("id"));
  const programId = str(formData.get("programId"));
  if (id) await db.workout.delete({ where: { id } }).catch(() => null);
  revalidatePath(`/admin/content/programs/${programId}`);
}

export async function deleteProgramAction(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const id = str(formData.get("id"));
  if (id) await db.program.delete({ where: { id } }).catch(() => null);
  revalidatePath("/admin/content/programs");
  redirect("/admin/content/programs");
}

/* ========================================================================== */
/* Diet plans                                                                 */
/* ========================================================================== */

const dietSchema = z.object({
  title: z.string().trim().min(2, "Give the plan a title.").max(120),
  description: z.string().trim().min(10, "Add a description.").max(4000),
  goal: z.string().trim().max(40),
  kcalTarget: z.number().int().min(500).max(8000),
  proteinG: z.number().int().min(0).max(600),
  carbsG: z.number().int().min(0).max(1200),
  fatG: z.number().int().min(0).max(400),
  durationDays: z.number().int().min(1).max(31),
  minTier: z.number().int().min(0).max(2),
});

export async function saveDietPlanAction(
  _prev: ContentState,
  formData: FormData,
): Promise<ContentState> {
  if (!(await requireAdmin())) return { error: "Admins only." };

  const id = str(formData.get("id"));
  const parsed = dietSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    goal: str(formData.get("goal")) || "recomp",
    kcalTarget: num(formData.get("kcalTarget"), 2200),
    proteinG: num(formData.get("proteinG"), 180),
    carbsG: num(formData.get("carbsG"), 200),
    fatG: num(formData.get("fatG"), 70),
    durationDays: num(formData.get("durationDays"), 7),
    minTier: num(formData.get("minTier"), 1),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const data = {
    ...parsed.data,
    isPublished: bool(formData.get("isPublished")),
    coverUrl: str(formData.get("coverUrl")) || null,
  };

  if (id) {
    await db.dietPlan.update({ where: { id }, data });
    revalidatePath("/admin/content/nutrition");
    revalidatePath("/nutrition");
    return { notice: "Diet plan saved." };
  }

  const slug = await uniqueSlug(parsed.data.title, async (s) =>
    Boolean(await db.dietPlan.findUnique({ where: { slug: s } })),
  );
  const created = await db.dietPlan.create({ data: { ...data, slug } });
  revalidatePath("/admin/content/nutrition");
  revalidatePath("/nutrition");
  redirect(`/admin/content/nutrition/${created.id}`);
}

export async function saveMealAction(
  _prev: ContentState,
  formData: FormData,
): Promise<ContentState> {
  if (!(await requireAdmin())) return { error: "Admins only." };

  const dietPlanId = str(formData.get("dietPlanId"));
  const title = str(formData.get("title"));
  if (!dietPlanId || title.length < 2) return { error: "Give the meal a title." };

  const ingredients = str(formData.get("ingredients"))
    .split("\n")
    .map((i) => i.trim())
    .filter(Boolean);

  const data = {
    dietPlanId,
    dayNumber: num(formData.get("dayNumber"), 1),
    slot: str(formData.get("slot")) || "breakfast",
    title,
    ingredients: JSON.stringify(ingredients),
    method: str(formData.get("method")) || null,
    kcal: num(formData.get("kcal")),
    proteinG: num(formData.get("proteinG")),
    carbsG: num(formData.get("carbsG")),
    fatG: num(formData.get("fatG")),
    sortOrder: num(formData.get("sortOrder")),
  };

  const id = str(formData.get("id"));
  if (id) {
    await db.meal.update({ where: { id }, data });
  } else {
    await db.meal.create({ data });
  }

  revalidatePath(`/admin/content/nutrition/${dietPlanId}`);
  revalidatePath("/nutrition");
  return { notice: id ? "Meal saved." : "Meal added." };
}

export async function deleteMealAction(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const id = str(formData.get("id"));
  const dietPlanId = str(formData.get("dietPlanId"));
  if (id) await db.meal.delete({ where: { id } }).catch(() => null);
  revalidatePath(`/admin/content/nutrition/${dietPlanId}`);
}

export async function deleteDietPlanAction(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const id = str(formData.get("id"));
  if (id) await db.dietPlan.delete({ where: { id } }).catch(() => null);
  revalidatePath("/admin/content/nutrition");
  redirect("/admin/content/nutrition");
}

/* ========================================================================== */
/* Supplement plans                                                           */
/* ========================================================================== */

export async function saveSupplementPlanAction(
  _prev: ContentState,
  formData: FormData,
): Promise<ContentState> {
  if (!(await requireAdmin())) return { error: "Admins only." };

  const title = str(formData.get("title"));
  const description = str(formData.get("description"));
  if (title.length < 2) return { error: "Give the plan a title." };
  if (description.length < 10) return { error: "Add a description." };

  const data = {
    title,
    description,
    goal: str(formData.get("goal")) || "general",
    minTier: num(formData.get("minTier"), 1),
    isPublished: bool(formData.get("isPublished")),
    sortOrder: num(formData.get("sortOrder")),
    disclaimer:
      str(formData.get("disclaimer")) ||
      "General information, not medical advice. Check with a doctor before starting any supplement, especially if you take medication.",
  };

  const id = str(formData.get("id"));
  if (id) {
    await db.supplementPlan.update({ where: { id }, data });
    revalidatePath("/admin/content/supplements");
    revalidatePath("/supplements");
    return { notice: "Supplement plan saved." };
  }

  const slug = await uniqueSlug(title, async (s) =>
    Boolean(await db.supplementPlan.findUnique({ where: { slug: s } })),
  );
  const created = await db.supplementPlan.create({ data: { ...data, slug } });
  revalidatePath("/admin/content/supplements");
  revalidatePath("/supplements");
  redirect(`/admin/content/supplements/${created.id}`);
}

export async function saveSupplementItemAction(
  _prev: ContentState,
  formData: FormData,
): Promise<ContentState> {
  if (!(await requireAdmin())) return { error: "Admins only." };

  const supplementPlanId = str(formData.get("supplementPlanId"));
  const name = str(formData.get("name"));
  if (!supplementPlanId || name.length < 2) return { error: "Give the item a name." };

  const data = {
    supplementPlanId,
    name,
    dose: str(formData.get("dose")) || "—",
    timing: str(formData.get("timing")) || "daily",
    purpose: str(formData.get("purpose")) || "",
    evidenceNote: str(formData.get("evidenceNote")) || null,
    tier: str(formData.get("tier")) || "core",
    monthlyCostCents: Math.round(num(formData.get("monthlyCost")) * 100),
    sortOrder: num(formData.get("sortOrder")),
  };

  const id = str(formData.get("id"));
  if (id) {
    await db.supplementItem.update({ where: { id }, data });
  } else {
    await db.supplementItem.create({ data });
  }

  revalidatePath(`/admin/content/supplements/${supplementPlanId}`);
  revalidatePath("/supplements");
  return { notice: id ? "Item saved." : "Item added." };
}

export async function deleteSupplementItemAction(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const id = str(formData.get("id"));
  const planId = str(formData.get("supplementPlanId"));
  if (id) await db.supplementItem.delete({ where: { id } }).catch(() => null);
  revalidatePath(`/admin/content/supplements/${planId}`);
}

export async function deleteSupplementPlanAction(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const id = str(formData.get("id"));
  if (id) await db.supplementPlan.delete({ where: { id } }).catch(() => null);
  revalidatePath("/admin/content/supplements");
  redirect("/admin/content/supplements");
}

/* ========================================================================== */
/* Knowledge articles                                                         */
/* ========================================================================== */

export async function saveArticleAction(
  _prev: ContentState,
  formData: FormData,
): Promise<ContentState> {
  if (!(await requireAdmin())) return { error: "Admins only." };

  const title = str(formData.get("title"));
  const excerpt = str(formData.get("excerpt"));
  const body = str(formData.get("body"));
  if (title.length < 2) return { error: "Give the article a title." };
  if (excerpt.length < 10) return { error: "Add a short summary." };
  if (body.length < 20) return { error: "The article body is too short." };

  const words = body.split(/\s+/).length;
  const data = {
    title,
    excerpt,
    body,
    categoryId: str(formData.get("categoryId")) || null,
    minTier: num(formData.get("minTier")),
    isPublished: bool(formData.get("isPublished")),
    // 200 wpm is the usual reading-speed assumption.
    readMinutes: Math.max(1, Math.round(words / 200)),
  };

  const id = str(formData.get("id"));
  if (id) {
    await db.article.update({ where: { id }, data });
    revalidatePath("/admin/content/articles");
    revalidatePath("/knowledge");
    return { notice: "Article saved." };
  }

  const slug = await uniqueSlug(title, async (s) =>
    Boolean(await db.article.findUnique({ where: { slug: s } })),
  );
  const created = await db.article.create({ data: { ...data, slug } });
  revalidatePath("/admin/content/articles");
  revalidatePath("/knowledge");
  redirect(`/admin/content/articles/${created.id}`);
}

export async function deleteArticleAction(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const id = str(formData.get("id"));
  if (id) await db.article.delete({ where: { id } }).catch(() => null);
  revalidatePath("/admin/content/articles");
  redirect("/admin/content/articles");
}

/** Quick publish/unpublish from a list, without opening the editor. */
export async function togglePublishAction(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const type = str(formData.get("type"));
  const id = str(formData.get("id"));
  if (!id) return;

  if (type === "program") {
    const row = await db.program.findUnique({ where: { id } });
    if (row) await db.program.update({ where: { id }, data: { isPublished: !row.isPublished } });
    revalidatePath("/admin/content/programs");
    revalidatePath("/programs");
  } else if (type === "diet") {
    const row = await db.dietPlan.findUnique({ where: { id } });
    if (row) await db.dietPlan.update({ where: { id }, data: { isPublished: !row.isPublished } });
    revalidatePath("/admin/content/nutrition");
    revalidatePath("/nutrition");
  } else if (type === "supplement") {
    const row = await db.supplementPlan.findUnique({ where: { id } });
    if (row)
      await db.supplementPlan.update({ where: { id }, data: { isPublished: !row.isPublished } });
    revalidatePath("/admin/content/supplements");
    revalidatePath("/supplements");
  } else if (type === "article") {
    const row = await db.article.findUnique({ where: { id } });
    if (row) await db.article.update({ where: { id }, data: { isPublished: !row.isPublished } });
    revalidatePath("/admin/content/articles");
    revalidatePath("/knowledge");
  }
}
