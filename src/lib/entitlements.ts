import type { ContentType, Plan, Subscription } from "@prisma/client";
import { db } from "./db";

export type ActiveSub = Subscription & { plan: Plan };

export type Entitlement = {
  /** Highest tier the member currently has access to. 0 = free. */
  tier: number;
  planName: string;
  planKey: string;
  status: string;
  isPaying: boolean;
  isTrialing: boolean;
  inGracePeriod: boolean;
  coachingCreditsLeft: number;
  includesCoaching: boolean;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

export const FREE_ENTITLEMENT: Entitlement = {
  tier: 0,
  planName: "Free",
  planKey: "free",
  status: "none",
  isPaying: false,
  isTrialing: false,
  inGracePeriod: false,
  coachingCreditsLeft: 0,
  includesCoaching: false,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
};

/**
 * Collapse a member's subscriptions into a single entitlement.
 *
 * PAST_DUE keeps access on purpose: dunning recovers a meaningful share of
 * failed payments, and locking someone out on day one of a card failure
 * converts a retryable decline into a cancellation.
 */
export function entitlementFor(subs: ActiveSub[]): Entitlement {
  const usable = subs.filter((s) =>
    ["ACTIVE", "TRIALING", "PAST_DUE"].includes(s.status),
  );
  if (usable.length === 0) return FREE_ENTITLEMENT;

  const best = usable.reduce((a, b) => (b.plan.tier > a.plan.tier ? b : a));

  return {
    tier: best.plan.tier,
    planName: best.plan.name,
    planKey: best.plan.key,
    status: best.status,
    isPaying: best.status === "ACTIVE" || best.status === "PAST_DUE",
    isTrialing: best.status === "TRIALING",
    inGracePeriod: best.status === "PAST_DUE",
    coachingCreditsLeft: best.coachingCreditsLeft,
    includesCoaching: best.plan.includesCoaching,
    currentPeriodEnd: best.currentPeriodEnd,
    cancelAtPeriodEnd: best.cancelAtPeriodEnd,
  };
}

export function canAccess(entitlement: Entitlement, minTier: number): boolean {
  return entitlement.tier >= minTier;
}

export const TIER_LABELS: Record<number, string> = {
  0: "Free",
  1: "Core",
  2: "Elite",
};

export function tierLabel(tier: number): string {
  return TIER_LABELS[tier] ?? `Tier ${tier}`;
}

export function formatMoney(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/* -------------------------------------------------------------------------- */
/* Explicit per-item access                                                   */
/* -------------------------------------------------------------------------- */


/**
 * The set of content a member has been granted explicitly, as "TYPE:id" keys.
 *
 * Loaded once per request and passed down, so a page listing 40 programs makes
 * one query rather than 40. Expired grants are filtered out here so callers
 * never have to think about it.
 */
export async function getAccessKeys(userId: string): Promise<Set<string>> {
  const now = new Date();
  const grants = await db.accessGrant.findMany({
    where: {
      userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { contentType: true, contentId: true },
  });
  return new Set(grants.map((g) => accessKey(g.contentType, g.contentId)));
}

export function accessKey(type: ContentType, id: string): string {
  return `${type}:${id}`;
}

/**
 * Can this member open this specific piece of content?
 *
 * Two independent routes in: their subscription tier covers it, or they hold a
 * grant for it (bought it, or you gave it to them). Either is sufficient.
 */
export function canAccessContent(
  entitlement: Entitlement,
  accessKeys: Set<string>,
  content: { type: ContentType; id: string; minTier: number },
): boolean {
  if (entitlement.tier >= content.minTier) return true;
  return accessKeys.has(accessKey(content.type, content.id));
}

/** Why a member can see something — used to label the UI honestly. */
export function accessReason(
  entitlement: Entitlement,
  accessKeys: Set<string>,
  content: { type: ContentType; id: string; minTier: number },
): "plan" | "purchased" | "locked" {
  if (entitlement.tier >= content.minTier) return "plan";
  if (accessKeys.has(accessKey(content.type, content.id))) return "purchased";
  return "locked";
}

/** Everything needed to answer "can they see this?" for a whole page render. */
export async function accessContextFor(user: {
  id: string;
  subscriptions: ActiveSub[];
}): Promise<{ entitlement: Entitlement; accessKeys: Set<string> }> {
  return {
    entitlement: entitlementFor(user.subscriptions),
    accessKeys: await getAccessKeys(user.id),
  };
}
