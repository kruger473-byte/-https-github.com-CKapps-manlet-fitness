import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getAppUrl } from "@/lib/settings";
import { formatMoney } from "@/lib/entitlements";
import { integrationStatus } from "@/lib/integrations/hub";
import {
  TrackedLinkForm,
  AddChannelForm,
  TestConversionForm,
  CopyField,
} from "@/components/growth-forms";
import {
  createTrackedLinkAction,
  addChannelAction,
  deleteTrackedLinkAction,
  sendTestConversionAction,
} from "./actions";
import { PageHeader, Card, Badge, Stat, EmptyState, ButtonLink, Alert } from "@/components/ui";

export const metadata: Metadata = { title: "Growth" };
export const dynamic = "force-dynamic";

export default async function GrowthPage({
  searchParams,
}: {
  searchParams: Promise<{ integration?: string }>;
}) {
  const { integration: integrationMessage } = await searchParams;
  const appUrl = await getAppUrl();
  const [channels, links, conversions, contentPosts] = await Promise.all([
    db.channel.findMany({ orderBy: { platform: "asc" } }),
    db.trackedLink.findMany({
      orderBy: { createdAt: "desc" },
      include: { channel: true, _count: { select: { clicks: true } } },
    }),
    db.conversionEvent.findMany({
      orderBy: { occurredAt: "desc" },
      take: 12,
      include: { channel: true, user: true },
    }),
    db.contentPost.findMany({
      orderBy: { publishedAt: "desc" },
      take: 6,
      include: { channel: true },
    }),
  ]);

  const integrations = integrationStatus();
  const totalClicks = links.reduce((n, l) => n + l._count.clicks, 0);
  const delivered = conversions.filter(
    (c) => c.metaSyncedAt || c.tiktokSyncedAt || c.googleSyncedAt,
  ).length;

  return (
    <>
      <PageHeader
        eyebrow="Creator console"
        title="Growth & channels"
        description="Turn social reach into tracked, attributable revenue — and send those conversions back to the ad platforms server-side so they keep optimising after the browser drops the cookie."
        action={<ButtonLink href="/admin" variant="secondary">Revenue</ButtonLink>}
      />

      {integrationMessage ? (
        <div className="mb-6">
          <Alert tone="info">{integrationMessage}</Alert>
        </div>
      ) : null}

      <div className="mb-8 grid gap-4 sm:grid-cols-4">
        <Stat label="Tracked links" value={String(links.length)} sub="live" />
        <Stat label="Total clicks" value={totalClicks.toLocaleString()} sub="all time" />
        <Stat label="Channels" value={String(channels.length)} sub={`${channels.filter((c) => c.isConnected).length} connected`} />
        <Stat
          label="Conversions sent"
          value={`${delivered}/${conversions.length}`}
          sub="of the latest batch"
        />
      </div>

      {/* Integrations ------------------------------------------------- */}
      <section className="mb-10">
        <h2 className="mb-1 text-base font-semibold">Integrations</h2>
        <p className="mb-4 text-sm text-ink-400">
          Each of these is optional — the app runs without them, and every unconfigured
          destination is skipped rather than failing the request.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          {integrations.map((integration) => (
            <Card key={integration.key}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{integration.label}</h3>
                <Badge tone={integration.configured ? "success" : "neutral"}>
                  {integration.configured ? "configured" : "not configured"}
                </Badge>
              </div>
              <p className="text-xs text-ink-400">{integration.purpose}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {integration.envVars.map((v) => (
                  <code
                    key={v}
                    className="rounded bg-ink-850 px-1.5 py-0.5 text-[10px] text-ink-400"
                  >
                    {v}
                  </code>
                ))}
              </div>
              {integration.oauth ? (
                <Link
                  href={`/api/integrations/${integration.key}/connect`}
                  className="mt-3 inline-block text-xs font-medium text-volt-500 hover:underline"
                >
                  Connect account →
                </Link>
              ) : null}
            </Card>
          ))}
        </div>

        <Card className="mt-4">
          <h3 className="mb-1 text-sm font-semibold">Verify the conversion pipeline</h3>
          <TestConversionForm action={sendTestConversionAction} />
        </Card>
      </section>

      {/* Tracked links ------------------------------------------------ */}
      <section className="mb-10">
        <h2 className="mb-1 text-base font-semibold">Tracked links</h2>
        <p className="mb-4 text-sm text-ink-400">
          Put <code className="text-ink-300">{appUrl}/go/&lt;slug&gt;</code> in a bio
          or caption. Every click is recorded and stitched to the signup it eventually
          produces — even weeks later.
        </p>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2 p-0">
            {links.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="No tracked links yet"
                  description="Create one and put it in your Instagram bio. Attribution starts from the first click."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[38rem] text-sm">
                  <thead>
                    <tr className="border-b border-ink-800 text-left text-xs uppercase tracking-wider text-ink-400">
                      <th className="px-5 py-3 font-medium">Link</th>
                      <th className="px-5 py-3 font-medium">Channel</th>
                      <th className="px-5 py-3 font-medium">Campaign</th>
                      <th className="px-5 py-3 text-right font-medium">Clicks</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {links.map((link) => (
                      <tr key={link.id} className="border-b border-ink-800 last:border-0">
                        <td className="px-5 py-3">
                          <CopyField value={`${appUrl}/go/${link.slug}`} />
                          <p className="mt-1 text-xs text-ink-400">→ {link.destination}</p>
                        </td>
                        <td className="px-5 py-3">
                          {link.channel ? (
                            <Badge>{link.channel.platform}</Badge>
                          ) : (
                            <span className="text-xs text-ink-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-xs text-ink-400">
                          {link.campaign ?? "—"}
                        </td>
                        <td className="px-5 py-3 text-right font-medium tabular-nums">
                          {link._count.clicks.toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <form action={deleteTrackedLinkAction}>
                            <input type="hidden" name="linkId" value={link.id} />
                            <button
                              type="submit"
                              className="text-xs text-ink-400 transition-colors hover:text-red-300"
                            >
                              Delete
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <h3 className="mb-4 text-sm font-semibold">New tracked link</h3>
            <TrackedLinkForm
              action={createTrackedLinkAction}
              channels={channels.map((c) => ({
                id: c.id,
                label: `${c.platform} · ${c.handle}`,
              }))}
            />
          </Card>
        </div>
      </section>

      {/* Channels ----------------------------------------------------- */}
      <section className="mb-10">
        <h2 className="mb-4 text-base font-semibold">Channels</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            {channels.map((channel) => (
              <Card key={channel.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge>{channel.platform}</Badge>
                    <span className="text-sm font-medium">{channel.handle}</span>
                  </div>
                  <p className="mt-1 text-xs text-ink-400">{channel.displayName}</p>
                </div>
                <Badge tone={channel.isConnected ? "success" : "neutral"}>
                  {channel.isConnected ? "connected" : "not connected"}
                </Badge>
              </Card>
            ))}
          </div>
          <Card>
            <h3 className="mb-4 text-sm font-semibold">Add a channel</h3>
            <AddChannelForm action={addChannelAction} />
          </Card>
        </div>
      </section>

      {/* Content performance ------------------------------------------ */}
      {contentPosts.length > 0 ? (
        <section className="mb-10">
          <h2 className="mb-1 text-base font-semibold">Recent content</h2>
          <p className="mb-4 text-sm text-ink-400">
            Synced from your connected accounts. Pair a tracked link with a post to see
            which content produces members rather than just views.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {contentPosts.map((post) => (
              <Card key={post.id}>
                <div className="mb-2 flex items-center gap-2">
                  <Badge>{post.channel.platform}</Badge>
                  <span className="text-xs text-ink-400">
                    {post.publishedAt.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
                <p className="text-sm">{post.caption}</p>
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-ink-400">
                  <span>{post.impressions.toLocaleString()} views</span>
                  <span>{post.likes.toLocaleString()} likes</span>
                  <span>{post.comments.toLocaleString()} comments</span>
                  <span>{post.shares.toLocaleString()} shares</span>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {/* Conversion log ----------------------------------------------- */}
      <section>
        <h2 className="mb-1 text-base font-semibold">Conversion delivery log</h2>
        <p className="mb-4 text-sm text-ink-400">
          Every conversion is stored here first. The ad platforms are downstream
          consumers — if they are unconfigured or failing, your own record is intact.
        </p>
        {conversions.length === 0 ? (
          <EmptyState
            title="No conversions recorded yet"
            description="Signups and subscriptions record here automatically."
          />
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[44rem] text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-left text-xs uppercase tracking-wider text-ink-400">
                  <th className="px-5 py-3 font-medium">Event</th>
                  <th className="px-5 py-3 font-medium">Member</th>
                  <th className="px-5 py-3 font-medium">Channel</th>
                  <th className="px-5 py-3 text-right font-medium">Value</th>
                  <th className="px-5 py-3 font-medium">Meta</th>
                  <th className="px-5 py-3 font-medium">TikTok</th>
                  <th className="px-5 py-3 font-medium">Google</th>
                </tr>
              </thead>
              <tbody>
                {conversions.map((c) => (
                  <tr key={c.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-5 py-3">
                      <Badge tone="volt">{c.type}</Badge>
                      <p className="mt-1 text-xs text-ink-400">
                        {c.occurredAt.toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-xs text-ink-300">
                      {c.user?.name ?? "anonymous"}
                    </td>
                    <td className="px-5 py-3 text-xs text-ink-400">
                      {c.channel ? `${c.channel.platform} · ${c.channel.handle}` : "direct"}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {c.valueCents > 0 ? formatMoney(c.valueCents, c.currency) : "—"}
                    </td>
                    <SyncCell at={c.metaSyncedAt} />
                    <SyncCell at={c.tiktokSyncedAt} />
                    <SyncCell at={c.googleSyncedAt} />
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </>
  );
}

function SyncCell({ at }: { at: Date | null }) {
  return (
    <td className="px-5 py-3">
      {at ? (
        <span className="text-xs text-emerald-300">sent</span>
      ) : (
        <span className="text-xs text-ink-400">—</span>
      )}
    </td>
  );
}
