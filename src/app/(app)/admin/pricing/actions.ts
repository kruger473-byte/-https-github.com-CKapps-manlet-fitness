"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ContentType } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export type PricingState = { error?: string; notice?: string };

async function requireAdmin() {
  const user = await getCurrentUser();
  return user && user.role === "ADMIN" ? user : null;
}

const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const bool = (v: FormDataEntryValue | null) => v === "on" || v === "true";
const cents = (v: FormDataEntryValue | null) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
};
const int = (v: FormDataEntryValue | null, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : fallback;
};

/* ========================================================================== */
/* Subscription plans                                                         */
/* ========================================================================== */

const planSchema = z.object({
  name: z.string().trim().min(1, "Give the plan a name.").max(40),
  tagline: z.string().trim().min(1, "Add a one-line tagline.").max(120),
  priceMonthlyCents: z.number().int().min(0).max(10_000_00),
  priceYearlyCents: z.number().int().min(0).max(100_000_00),
  trialDays: z.number().int().min(0).max(90),
  coachingCreditsPerMonth: z.number().int().min(0).max(30),
});

export async function savePlanAction(
  _prev: PricingState,
  formData: FormData,
): Promise<PricingState> {
  if (!(await requireAdmin())) return { error: "Admins only." };

  const id = str(formData.get("id"));
  const plan = await db.plan.findUnique({ where: { id } });
  if (!plan) return { error: "Plan not found." };

  const parsed = planSchema.safeParse({
    name: formData.get("name"),
    tagline: formData.get("tagline"),
    priceMonthlyCents: cents(formData.get("priceMonthly")),
    priceYearlyCents: cents(formData.get("priceYearly")),
    trialDays: int(formData.get("trialDays")),
    coachingCreditsPerMonth: int(formData.get("coachingCredits")),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  // The free tier is what unsubscribed members fall back to. Letting it carry
  // a price would silently paywall everything.
  if (plan.tier === 0 && parsed.data.priceMonthlyCents > 0) {
    return { error: "The free plan must stay at zero. Create a new plan instead." };
  }

  const features = str(formData.get("features"))
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);

  await db.plan.update({
    where: { id },
    data: {
      name: parsed.data.name,
      tagline: parsed.data.tagline,
      priceMonthlyCents: parsed.data.priceMonthlyCents,
      priceYearlyCents: parsed.data.priceYearlyCents,
      currency: str(formData.get("currency")).toLowerCase() || plan.currency,
      trialDays: parsed.data.trialDays,
      features: JSON.stringify(features),
      includesCoaching: bool(formData.get("includesCoaching")),
      coachingCreditsPerMonth: parsed.data.coachingCreditsPerMonth,
      stripePriceIdMonthly: str(formData.get("stripePriceIdMonthly")) || null,
      stripePriceIdYearly: str(formData.get("stripePriceIdYearly")) || null,
      isActive: bool(formData.get("isActive")),
      sortOrder: int(formData.get("sortOrder")),
    },
  });

  revalidateAll();
  return {
    notice:
      "Plan saved. Existing subscribers keep the price they signed up at until they change plan.",
  };
}

/* ========================================================================== */
/* One-off products                                                           */
/* ========================================================================== */

const VALID_TYPES: ContentType[] = [
  "PROGRAM",
  "DIET_PLAN",
  "SUPPLEMENT_PLAN",
  "ARTICLE",
  "BUNDLE",
];

export async function saveProductAction(
  _prev: PricingState,
  formData: FormData,
): Promise<PricingState> {
  if (!(await requireAdmin())) return { error: "Admins only." };

  const name = str(formData.get("name"));
  const description = str(formData.get("description"));
  if (name.length < 2) return { error: "Give the product a name." };
  if (description.length < 5) return { error: "Add a short description." };

  const priceCents = cents(formData.get("price"));
  if (priceCents <= 0) return { error: "Set a price above zero." };

  const contentType = str(formData.get("contentType")) as ContentType;
  if (!VALID_TYPES.includes(contentType)) return { error: "Pick what this unlocks." };

  // "TYPE:id" values come from the picker; a bundle takes several.
  const selected = formData.getAll("contentRef").map(String).filter(Boolean);

  let contentId: string | null = null;
  let bundledIds = "[]";

  if (contentType === "BUNDLE") {
    if (selected.length < 2) {
      return { error: "A bundle needs at least two items. Pick more, or choose a single type." };
    }
    bundledIds = JSON.stringify(selected);
  } else {
    const single = selected.find((s) => s.startsWith(`${contentType}:`));
    if (!single) {
      return { error: "Choose which item this product unlocks." };
    }
    contentId = single.split(":")[1] ?? null;
    if (!contentId) return { error: "That item could not be read. Pick it again." };
  }

  const data = {
    name,
    description,
    priceCents,
    currency: str(formData.get("currency")).toLowerCase() || "usd",
    stripePriceId: str(formData.get("stripePriceId")) || null,
    contentType,
    contentId,
    bundledIds,
    isActive: bool(formData.get("isActive")),
    sortOrder: int(formData.get("sortOrder")),
  };

  const id = str(formData.get("id"));
  if (id) {
    await db.product.update({ where: { id }, data });
  } else {
    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 50) || `product-${Date.now().toString(36)}`;
    let slug = base;
    if (await db.product.findUnique({ where: { slug } })) {
      slug = `${base}-${Date.now().toString(36).slice(-4)}`;
    }
    await db.product.create({ data: { ...data, slug } });
  }

  revalidateAll();
  return { notice: id ? "Product saved." : `"${name}" is now on sale.` };
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const id = str(formData.get("id"));
  if (!id) return;
  // Grants already handed out survive: the relation is SetNull, so members who
  // bought this keep what they paid for.
  await db.product.delete({ where: { id } }).catch(() => null);
  revalidateAll();
}

export async function toggleProductAction(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const id = str(formData.get("id"));
  const product = await db.product.findUnique({ where: { id } });
  if (product) {
    await db.product.update({ where: { id }, data: { isActive: !product.isActive } });
  }
  revalidateAll();
}

/* ========================================================================== */
/* Manual grants                                                              */
/* ========================================================================== */

/** Hand someone access without a payment — refunds, comps, support fixes. */
export async function grantAccessManuallyAction(
  _prev: PricingState,
  formData: FormData,
): Promise<PricingState> {
  if (!(await requireAdmin())) return { error: "Admins only." };

  const email = str(formData.get("email")).toLowerCase();
  const ref = str(formData.get("contentRef"));
  if (!email || !ref) return { error: "Enter an email and pick an item." };

  const user = await db.user.findUnique({ where: { email } });
  if (!user) return { error: `No member with the email ${email}.` };

  const [contentType, contentId] = ref.split(":");
  if (!contentId || !VALID_TYPES.includes(contentType as ContentType)) {
    return { error: "That item could not be read. Pick it again." };
  }

  await db.accessGrant.upsert({
    where: {
      userId_contentType_contentId: {
        userId: user.id,
        contentType: contentType as ContentType,
        contentId,
      },
    },
    update: { source: "MANUAL", note: str(formData.get("note")) || null },
    create: {
      userId: user.id,
      contentType: contentType as ContentType,
      contentId,
      source: "MANUAL",
      note: str(formData.get("note")) || null,
    },
  });

  revalidateAll();
  return { notice: `${user.name} now has access.` };
}

export async function revokeGrantAction(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const id = str(formData.get("id"));
  if (id) await db.accessGrant.delete({ where: { id } }).catch(() => null);
  revalidateAll();
}

/** Prices and products show up across the marketing site and the app. */
function revalidateAll() {
  revalidatePath("/", "layout");
}
