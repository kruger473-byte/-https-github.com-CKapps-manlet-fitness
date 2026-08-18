import { db } from "./db";

export type RevenueSnapshot = {
  mrrCents: number;
  arrCents: number;
  activeMembers: number;
  trialingMembers: number;
  pastDueMembers: number;
  arpuCents: number;
  monthlyChurnRate: number;
  estimatedLtvCents: number;
  netNewThisMonth: number;
  canceledThisMonth: number;
};

/** Normalise any billing interval to a monthly figure. */
function monthlyCents(priceMonthly: number, priceYearly: number, interval: string) {
  return interval === "year" ? Math.round(priceYearly / 12) : priceMonthly;
}

export async function getRevenueSnapshot(): Promise<RevenueSnapshot> {
  const subs = await db.subscription.findMany({
    where: { status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } },
    include: { plan: true },
  });

  const paying = subs.filter((s) => s.status === "ACTIVE" || s.status === "PAST_DUE");
  const mrrCents = paying.reduce(
    (sum, s) =>
      sum + monthlyCents(s.plan.priceMonthlyCents, s.plan.priceYearlyCents, s.interval),
    0,
  );

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [canceledThisMonth, netNewThisMonth, totalEverActive] = await Promise.all([
    db.subscription.count({
      where: { status: "CANCELED", canceledAt: { gte: startOfMonth } },
    }),
    db.subscription.count({ where: { createdAt: { gte: startOfMonth } } }),
    db.subscription.count(),
  ]);

  const activeMembers = paying.length;
  const denominator = activeMembers + canceledThisMonth;
  const monthlyChurnRate = denominator > 0 ? canceledThisMonth / denominator : 0;
  const arpuCents = activeMembers > 0 ? Math.round(mrrCents / activeMembers) : 0;

  // LTV = ARPU / churn. With no churn yet, fall back to a 24-month horizon
  // rather than reporting infinity.
  const estimatedLtvCents =
    monthlyChurnRate > 0 ? Math.round(arpuCents / monthlyChurnRate) : arpuCents * 24;

  return {
    mrrCents,
    arrCents: mrrCents * 12,
    activeMembers,
    trialingMembers: subs.filter((s) => s.status === "TRIALING").length,
    pastDueMembers: subs.filter((s) => s.status === "PAST_DUE").length,
    arpuCents,
    monthlyChurnRate,
    estimatedLtvCents,
    netNewThisMonth,
    canceledThisMonth: totalEverActive > 0 ? canceledThisMonth : 0,
  };
}

export type ChannelPerformance = {
  channelId: string | null;
  platform: string;
  handle: string;
  clicks: number;
  signups: number;
  subscribers: number;
  revenueCents: number;
  clickToSignup: number;
  signupToPaid: number;
  revenuePerClickCents: number;
};

/**
 * Per-channel funnel: clicks -> signups -> paying subscribers -> revenue.
 * This is the table that tells you which posts actually pay rent, so budget
 * follows evidence instead of follower count.
 */
export async function getChannelPerformance(): Promise<ChannelPerformance[]> {
  const channels = await db.channel.findMany({
    include: {
      trackedLinks: { include: { _count: { select: { clicks: true } } } },
      _count: { select: { users: true } },
    },
  });

  const rows: ChannelPerformance[] = [];

  for (const channel of channels) {
    const clicks = channel.trackedLinks.reduce((n, l) => n + l._count.clicks, 0);
    const signups = channel._count.users;

    const subscribers = await db.subscription.count({
      where: {
        status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] },
        user: { attributedChannelId: channel.id },
      },
    });

    const revenue = await db.conversionEvent.aggregate({
      where: { channelId: channel.id, type: { in: ["SUBSCRIBE", "PURCHASE"] } },
      _sum: { valueCents: true },
    });
    const revenueCents = revenue._sum.valueCents ?? 0;

    rows.push({
      channelId: channel.id,
      platform: channel.platform,
      handle: channel.handle,
      clicks,
      signups,
      subscribers,
      revenueCents,
      clickToSignup: clicks > 0 ? signups / clicks : 0,
      signupToPaid: signups > 0 ? subscribers / signups : 0,
      revenuePerClickCents: clicks > 0 ? Math.round(revenueCents / clicks) : 0,
    });
  }

  const directSignups = await db.user.count({ where: { attributedChannelId: null } });
  if (directSignups > 0) {
    rows.push({
      channelId: null,
      platform: "DIRECT",
      handle: "direct / unattributed",
      clicks: 0,
      signups: directSignups,
      subscribers: await db.subscription.count({
        where: {
          status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] },
          user: { attributedChannelId: null },
        },
      }),
      revenueCents: 0,
      clickToSignup: 0,
      signupToPaid: 0,
      revenuePerClickCents: 0,
    });
  }

  return rows.sort((a, b) => b.revenueCents - a.revenueCents);
}

/** MRR-ish revenue by month, from recorded payments. */
export async function getRevenueTrend(months = 6) {
  const since = new Date();
  since.setMonth(since.getMonth() - (months - 1));
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const payments = await db.payment.findMany({
    where: { createdAt: { gte: since }, status: "succeeded" },
    select: { amountCents: true, createdAt: true },
  });

  const buckets = new Map<string, number>();
  for (let i = 0; i < months; i++) {
    const d = new Date(since);
    d.setMonth(since.getMonth() + i);
    buckets.set(monthKey(d), 0);
  }
  for (const p of payments) {
    const key = monthKey(p.createdAt);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + p.amountCents);
  }

  return [...buckets.entries()].map(([month, cents]) => ({ month, cents }));
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
