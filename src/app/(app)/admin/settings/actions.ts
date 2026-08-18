"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isValidHex, normaliseOrigin, DEFAULT_SETTINGS } from "@/lib/settings";

export type SettingsState = { error?: string; notice?: string };

/** Logos are stored inline as data URIs, so keep them small. */
const MAX_LOGO_BYTES = 256 * 1024;
const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];

const settingsSchema = z.object({
  brandName: z.string().trim().min(1, "The brand needs a name.").max(60),
  monogram: z
    .string()
    .trim()
    .min(1, "Add 1–3 characters for the monogram.")
    .max(3, "The monogram is at most 3 characters."),
  tagline: z.string().trim().min(1, "Add a tagline.").max(120),
  metaDescription: z.string().trim().min(1, "Add a description.").max(300),
  accentColor: z.string().trim().refine(isValidHex, "Use a hex colour like #c8f31d."),
  canonicalUrl: z.string().trim().max(200).optional(),
  supportEmail: z.union([z.email("That email does not look right."), z.literal("")]).optional(),
});

async function requireAdmin() {
  const user = await getCurrentUser();
  return user && user.role === "ADMIN" ? user : null;
}

export async function saveSettingsAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  if (!(await requireAdmin())) return { error: "Admins only." };

  const parsed = settingsSchema.safeParse({
    brandName: formData.get("brandName"),
    monogram: formData.get("monogram"),
    tagline: formData.get("tagline"),
    metaDescription: formData.get("metaDescription"),
    accentColor: formData.get("accentColor"),
    canonicalUrl: formData.get("canonicalUrl") ?? "",
    supportEmail: formData.get("supportEmail") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  // An unparseable domain is rejected rather than silently ignored — a bad
  // canonical URL would break Stripe redirects and OAuth callbacks.
  const rawUrl = parsed.data.canonicalUrl ?? "";
  let canonicalUrl: string | null = null;
  if (rawUrl.trim()) {
    canonicalUrl = normaliseOrigin(rawUrl);
    if (!canonicalUrl) {
      return { error: `"${rawUrl}" is not a valid domain. Try train.example.com.` };
    }
  }

  const data = {
    brandName: parsed.data.brandName,
    monogram: parsed.data.monogram,
    tagline: parsed.data.tagline,
    metaDescription: parsed.data.metaDescription,
    accentColor: parsed.data.accentColor.toLowerCase(),
    canonicalUrl,
    supportEmail: parsed.data.supportEmail?.trim() || null,
  };

  await db.siteSettings.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });

  revalidateBranding();
  return { notice: "Branding saved. It's live across the site." };
}

export async function uploadLogoAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  if (!(await requireAdmin())) return { error: "Admins only." };

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image file first." };
  }
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
    return { error: "Use a PNG, JPEG, SVG or WebP image." };
  }
  if (file.size > MAX_LOGO_BYTES) {
    return {
      error: `That file is ${Math.round(file.size / 1024)}KB. Keep the logo under ${
        MAX_LOGO_BYTES / 1024
      }KB.`,
    };
  }

  // Stored inline so the app has no hard dependency on object storage. If you
  // move to a CDN later, swap this for an upload and store the URL instead —
  // everything downstream already accepts a plain URL.
  const buffer = Buffer.from(await file.arrayBuffer());
  const dataUri = `data:${file.type};base64,${buffer.toString("base64")}`;

  await db.siteSettings.upsert({
    where: { id: "singleton" },
    update: { logoUrl: dataUri },
    create: { id: "singleton", logoUrl: dataUri },
  });

  revalidateBranding();
  return { notice: "Logo updated." };
}

export async function removeLogoAction(
  _prev: SettingsState,
  _formData: FormData,
): Promise<SettingsState> {
  if (!(await requireAdmin())) return { error: "Admins only." };

  await db.siteSettings.upsert({
    where: { id: "singleton" },
    update: { logoUrl: null },
    create: { id: "singleton", logoUrl: null },
  });

  revalidateBranding();
  return { notice: "Logo removed — falling back to the monogram." };
}

export async function resetBrandingAction(
  _prev: SettingsState,
  _formData: FormData,
): Promise<SettingsState> {
  if (!(await requireAdmin())) return { error: "Admins only." };

  await db.siteSettings.upsert({
    where: { id: "singleton" },
    update: { ...DEFAULT_SETTINGS, canonicalUrl: null, supportEmail: null },
    create: {
      id: "singleton",
      ...DEFAULT_SETTINGS,
      canonicalUrl: null,
      supportEmail: null,
    },
  });

  revalidateBranding();
  return { notice: "Branding reset to defaults." };
}

/** Branding appears in every layout, so the whole tree has to re-render. */
function revalidateBranding() {
  revalidatePath("/", "layout");
}
