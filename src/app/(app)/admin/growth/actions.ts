"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Platform } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { recordConversion } from "@/lib/integrations/hub";

export type GrowthState = { error?: string; notice?: string };

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

const linkSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2, "Give the link a slug.")
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only."),
  destination: z.string().trim().min(1).max(200),
  channelId: z.string().optional(),
  campaign: z.string().trim().max(80).optional(),
  note: z.string().trim().max(200).optional(),
});

export async function createTrackedLinkAction(
  _prev: GrowthState,
  formData: FormData,
): Promise<GrowthState> {
  if (!(await requireAdmin())) return { error: "Admins only." };

  const parsed = linkSchema.safeParse({
    slug: formData.get("slug"),
    destination: formData.get("destination"),
    channelId: formData.get("channelId") || undefined,
    campaign: formData.get("campaign") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const existing = await db.trackedLink.findUnique({
    where: { slug: parsed.data.slug },
  });
  if (existing) return { error: "That slug is already in use." };

  const channel = parsed.data.channelId
    ? await db.channel.findUnique({ where: { id: parsed.data.channelId } })
    : null;

  await db.trackedLink.create({
    data: {
      slug: parsed.data.slug,
      destination: parsed.data.destination.startsWith("/")
        ? parsed.data.destination
        : `/${parsed.data.destination}`,
      channelId: channel?.id ?? null,
      campaign: parsed.data.campaign ?? null,
      medium: channel?.platform === "GOOGLE" ? "cpc" : "organic_social",
      note: parsed.data.note ?? null,
    },
  });

  revalidatePath("/admin/growth");
  return { notice: `Link created. Share /go/${parsed.data.slug}` };
}

const channelSchema = z.object({
  platform: z.enum([
    "INSTAGRAM",
    "META",
    "TIKTOK",
    "GOOGLE",
    "YOUTUBE",
    "EMAIL",
  ]),
  handle: z.string().trim().min(1, "Add the handle or account name.").max(80),
  displayName: z.string().trim().max(80).optional(),
});

export async function addChannelAction(
  _prev: GrowthState,
  formData: FormData,
): Promise<GrowthState> {
  if (!(await requireAdmin())) return { error: "Admins only." };

  const parsed = channelSchema.safeParse({
    platform: formData.get("platform"),
    handle: formData.get("handle"),
    displayName: formData.get("displayName") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const platform = parsed.data.platform as Platform;
  const existing = await db.channel.findUnique({
    where: { platform_handle: { platform, handle: parsed.data.handle } },
  });
  if (existing) return { error: "That channel already exists." };

  await db.channel.create({
    data: {
      platform,
      handle: parsed.data.handle,
      displayName: parsed.data.displayName || parsed.data.handle,
    },
  });

  revalidatePath("/admin/growth");
  return { notice: "Channel added. Connect it to pull content stats." };
}

export async function deleteTrackedLinkAction(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const id = formData.get("linkId");
  if (typeof id !== "string") return;
  await db.trackedLink.delete({ where: { id } }).catch(() => null);
  revalidatePath("/admin/growth");
}

/**
 * Send a test conversion through the whole dispatch path so you can verify
 * credentials before trusting live revenue data to them.
 */
export async function sendTestConversionAction(
  _prev: GrowthState,
  _formData: FormData,
): Promise<GrowthState> {
  const user = await requireAdmin();
  if (!user) return { error: "Admins only." };

  const result = await recordConversion({
    type: "LEAD",
    userId: user.id,
    valueCents: 100,
    email: user.email,
    firstName: user.name.split(" ")[0],
    dedupeScope: `test-${Date.now()}`,
  });

  const lines = result.dispatch.map((d) =>
    d.skipped
      ? `${d.platform}: skipped (${d.reason})`
      : d.ok
        ? `${d.platform}: delivered`
        : `${d.platform}: failed (${d.reason})`,
  );

  revalidatePath("/admin/growth");
  return { notice: lines.join(" · ") };
}
