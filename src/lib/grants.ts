import type { ContentType, GrantSource, Product } from "@prisma/client";
import { db } from "./db";

export type GrantTarget = { contentType: ContentType; contentId: string };

/**
 * Everything a product unlocks.
 *
 * A BUNDLE stores its members as "TYPE:id" strings, so one purchase can grant
 * several pieces of content. Anything unparseable is skipped rather than
 * throwing — a malformed bundle entry should not block a paid purchase.
 */
export function grantTargetsFor(product: Product): GrantTarget[] {
  if (product.contentType !== "BUNDLE") {
    return product.contentId
      ? [{ contentType: product.contentType, contentId: product.contentId }]
      : [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(product.bundledIds);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const valid: ContentType[] = [
    "PROGRAM",
    "DIET_PLAN",
    "SUPPLEMENT_PLAN",
    "ARTICLE",
  ];

  return parsed.flatMap((entry) => {
    if (typeof entry !== "string") return [];
    const [type, id] = entry.split(":");
    if (!id || !valid.includes(type as ContentType)) return [];
    return [{ contentType: type as ContentType, contentId: id }];
  });
}

/**
 * Grant access, idempotently.
 *
 * Uses upsert on the (user, type, id) unique key so replaying a Stripe webhook
 * or re-running a manual grant cannot fail or duplicate.
 */
export async function grantAccess(
  userId: string,
  targets: GrantTarget[],
  options: { source?: GrantSource; productId?: string; note?: string } = {},
): Promise<number> {
  let granted = 0;
  for (const target of targets) {
    await db.accessGrant.upsert({
      where: {
        userId_contentType_contentId: {
          userId,
          contentType: target.contentType,
          contentId: target.contentId,
        },
      },
      update: {
        source: options.source ?? "PURCHASE",
        productId: options.productId ?? null,
        note: options.note ?? null,
      },
      create: {
        userId,
        contentType: target.contentType,
        contentId: target.contentId,
        source: options.source ?? "PURCHASE",
        productId: options.productId ?? null,
        note: options.note ?? null,
      },
    });
    granted++;
  }
  return granted;
}

/** Human-readable titles for grant targets, for the account and admin views. */
export async function describeTargets(
  targets: GrantTarget[],
): Promise<Array<GrantTarget & { title: string; href: string | null }>> {
  const out: Array<GrantTarget & { title: string; href: string | null }> = [];

  for (const t of targets) {
    let title = "Unknown item";
    let href: string | null = null;

    if (t.contentType === "PROGRAM") {
      const row = await db.program.findUnique({ where: { id: t.contentId } });
      if (row) {
        title = row.title;
        href = `/programs/${row.slug}`;
      }
    } else if (t.contentType === "DIET_PLAN") {
      const row = await db.dietPlan.findUnique({ where: { id: t.contentId } });
      if (row) {
        title = row.title;
        href = `/nutrition/${row.slug}`;
      }
    } else if (t.contentType === "SUPPLEMENT_PLAN") {
      const row = await db.supplementPlan.findUnique({ where: { id: t.contentId } });
      if (row) {
        title = row.title;
        href = `/supplements/${row.slug}`;
      }
    } else if (t.contentType === "ARTICLE") {
      const row = await db.article.findUnique({ where: { id: t.contentId } });
      if (row) {
        title = row.title;
        href = `/knowledge/${row.slug}`;
      }
    }

    out.push({ ...t, title, href });
  }

  return out;
}
