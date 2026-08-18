import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/entitlements";
import {
  getRevenueSnapshot,
  getChannelPerformance,
  getRevenueTrend,
} from "@/lib/analytics";
import { BarChart } from "@/components/charts";
import { PageHeader, Card, Stat, Badge, EmptyState, ButtonLink } from "@/components/ui";

export const metadata: Metadata = { title: "Revenue" };
export const dynamic = "force-dynamic";

export default async function RevenueConsolePage() {
  const [snapshot, channels, trend, recentMembers, planBreakdown] = await Promise.all([
    getRevenueSnapshot(),
    getChannelPerformance(),
    getRevenueTrend(6),
    db.user.findMany({
      where: { role: "MEMBER" },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        attributedChannel: true,
        subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    db.subscription.groupBy({
      by: ["planId"],
      where: { status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } },
      _count: true,
    }),
  ]);

  const plans = await db.plan.findMany();
  const planNames = new Map(plans.map((p) => [p.id, p.name]));

  return (
    <>
      <PageHeader
        eyebrow="Creator console"
        title="Revenue"
        description="What the business is actually doing. Every figure here comes from your own database, not a platform dashboard you don't control."
        action={<ButtonLink href="/admin/growth" variant="secondary">Growth & channels</ButtonLink>}
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="MRR"
          value={formatMoney(snapshot.mrrCents)}
          sub={`${formatMoney(snapshot.arrCents)} annualised`}
          tone="good"
        />
        <Stat
          label="Paying members"
          value={String(snapshot.activeMembers)}
          sub={`${snapshot.trialingMembers} in trial`}
        />
        <Stat
          label="ARPU"
          value={formatMoney(snapshot.arpuCents)}
          sub="per paying member / month"
        />
        <Stat
          label="Est. LTV"
          value={formatMoney(snapshot.estimatedLtvCents)}
          sub={
            snapshot.monthlyChurnRate > 0
              ? `at ${(snapshot.monthlyChurnRate * 100).toFixed(1)}% monthly churn`
              : "no churn yet — 24-month horizon"
          }
        />
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Stat
          label="New this month"
          value={`+${snapshot.netNewThisMonth}`}
          sub="subscriptions started"
          tone="good"
        />
        <Stat
          label="Cancelled this month"
          value={String(snapshot.canceledThisMonth)}
          sub="subscriptions ended"
          tone={snapshot.canceledThisMonth > 0 ? "bad" : "neutral"}
        />
        <Stat
          label="Payment failures"
          value={String(snapshot.pastDueMembers)}
          sub="in grace period — recoverable"
          tone={snapshot.pastDueMembers > 0 ? "bad" : "neutral"}
        />
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-1 text-sm font-semibold">Collected revenue, last 6 months</h2>
          <p className="mb-5 text-xs text-ink-400">
            Cash actually collected, not billed.
          </p>
          <BarChart
            data={trend.map((t) => ({
              label: t.month.slice(5),
              value: t.cents,
            }))}
            formatValue={(v) => (v === 0 ? "—" : formatMoney(v))}
          />
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold">Members by plan</h2>
          <div className="space-y-3">
            {planBreakdown.map((row) => (
              <div key={row.planId} className="flex items-center justify-between">
                <span className="text-sm text-ink-300">
                  {planNames.get(row.planId) ?? "Unknown"}
                </span>
                <span className="text-sm font-bold tabular-nums">{row._count}</span>
              </div>
            ))}
            {planBreakdown.length === 0 ? (
              <p className="text-sm text-ink-400">No active subscriptions yet.</p>
            ) : null}
          </div>
        </Card>
      </div>

      {/* Channel performance — the table that decides where effort goes */}
      <section className="mb-8">
        <h2 className="mb-1 text-base font-semibold">Where the revenue came from</h2>
        <p className="mb-4 text-sm text-ink-400">
          Clicks through to paying members, per channel. This is the number that tells
          you which content is worth making more of — follower count does not.
        </p>

        {channels.length === 0 ? (
          <EmptyState
            title="No channel data yet"
            description="Create a tracked link and put it in a bio or caption. Clicks, signups and revenue will appear here."
            action={<ButtonLink href="/admin/growth">Create a tracked link</ButtonLink>}
          />
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-left text-xs uppercase tracking-wider text-ink-400">
                  <th className="px-5 py-3 font-medium">Channel</th>
                  <th className="px-5 py-3 text-right font-medium">Clicks</th>
                  <th className="px-5 py-3 text-right font-medium">Signups</th>
                  <th className="px-5 py-3 text-right font-medium">Click→signup</th>
                  <th className="px-5 py-3 text-right font-medium">Paying</th>
                  <th className="px-5 py-3 text-right font-medium">Signup→paid</th>
                  <th className="px-5 py-3 text-right font-medium">Revenue</th>
                  <th className="px-5 py-3 text-right font-medium">Rev/click</th>
                </tr>
              </thead>
              <tbody>
                {channels.map((c) => (
                  <tr
                    key={c.channelId ?? "direct"}
                    className="border-b border-ink-800 last:border-0"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Badge>{c.platform}</Badge>
                        <span className="text-ink-300">{c.handle}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {c.clicks.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{c.signups}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-ink-400">
                      {c.clicks > 0 ? `${(c.clickToSignup * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{c.subscribers}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-ink-400">
                      {c.signups > 0 ? `${(c.signupToPaid * 100).toFixed(0)}%` : "—"}
                    </td>
                    <td className="px-5 py-3 text-right font-medium tabular-nums text-volt-500">
                      {formatMoney(c.revenueCents)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-ink-400">
                      {c.clicks > 0 ? formatMoney(c.revenuePerClickCents) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-base font-semibold">Newest members</h2>
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b border-ink-800 text-left text-xs uppercase tracking-wider text-ink-400">
                <th className="px-5 py-3 font-medium">Member</th>
                <th className="px-5 py-3 font-medium">Plan</th>
                <th className="px-5 py-3 font-medium">Came from</th>
                <th className="px-5 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {recentMembers.map((m) => (
                <tr key={m.id} className="border-b border-ink-800 last:border-0">
                  <td className="px-5 py-3">
                    <p className="font-medium">{m.name}</p>
                    <p className="text-xs text-ink-400">{m.email}</p>
                  </td>
                  <td className="px-5 py-3">
                    {m.subscriptions[0] ? (
                      <Badge tone="volt">{m.subscriptions[0].plan.name}</Badge>
                    ) : (
                      <Badge>Free</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3 text-ink-400">
                    {m.attributedChannel
                      ? `${m.attributedChannel.platform} · ${m.attributedChannel.handle}`
                      : "direct"}
                    {m.attributionCampaign ? (
                      <span className="block text-xs">{m.attributionCampaign}</span>
                    ) : null}
                  </td>
                  <td className="px-5 py-3 text-ink-400">
                    {m.createdAt.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <p className="mt-6 text-xs text-ink-400">
        Need the acquisition side?{" "}
        <Link href="/admin/growth" className="text-volt-500 hover:underline">
          Growth & channels
        </Link>{" "}
        covers tracked links, connected accounts and server-side conversion delivery.
      </p>
    </>
  );
}
