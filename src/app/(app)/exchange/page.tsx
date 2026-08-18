import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { entitlementFor } from "@/lib/entitlements";
import { PageHeader, Badge, ButtonLink, Alert, EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Member exchange" };
export const dynamic = "force-dynamic";

export default async function ExchangePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const entitlement = entitlementFor(user.subscriptions);
  const canPost = entitlement.tier >= 1;

  const [threads, categories] = await Promise.all([
    db.thread.findMany({
      where: category ? { category: { slug: category } } : {},
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      include: {
        author: true,
        category: true,
        _count: { select: { posts: true, reactions: true } },
        posts: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { author: true },
        },
      },
    }),
    db.category.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Member exchange"
        title="Ask, answer, compare notes"
        description="The part members stay for. Coach answers are marked, so you can tell advice from opinion."
        action={
          canPost ? (
            <ButtonLink href="/exchange/new">Start a thread</ButtonLink>
          ) : null
        }
      />

      {!canPost ? (
        <div className="mb-6">
          <Alert tone="info">
            Reading is free. Posting and replying are included with Core.{" "}
            <Link href="/account/billing" className="font-medium underline">
              See plans
            </Link>
            .
          </Alert>
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-2">
        <Chip href="/exchange" label="All" active={!category} />
        {categories.map((c) => (
          <Chip
            key={c.id}
            href={`/exchange?category=${c.slug}`}
            label={c.name}
            active={category === c.slug}
          />
        ))}
      </div>

      {threads.length === 0 ? (
        <EmptyState
          title="No threads here yet"
          description="Be the first to ask something. The best threads here start with a real problem and real numbers."
          action={canPost ? <ButtonLink href="/exchange/new">Start a thread</ButtonLink> : undefined}
        />
      ) : (
        <div className="space-y-3">
          {threads.map((thread) => {
            const lastPost = thread.posts[0];
            return (
              <Link
                key={thread.id}
                href={`/exchange/${thread.slug}`}
                className="card block p-5 transition-colors hover:border-volt-500/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      {thread.isPinned ? <Badge tone="volt">Pinned</Badge> : null}
                      {thread.category ? <Badge>{thread.category.name}</Badge> : null}
                      {thread.posts.some((p) => p.isCoachAnswer) ? (
                        <Badge tone="success">Coach answered</Badge>
                      ) : null}
                    </div>
                    <h2 className="text-base font-semibold">{thread.title}</h2>
                    <p className="mt-1.5 line-clamp-2 text-sm text-ink-400">
                      {thread.body}
                    </p>
                    <p className="mt-2.5 text-xs text-ink-400">
                      {thread.author.name} ·{" "}
                      {thread.createdAt.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                      {lastPost
                        ? ` · last reply from ${lastPost.author.name}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-4 text-center">
                    <div>
                      <p className="text-lg font-bold tabular-nums">
                        {thread._count.posts}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-ink-400">
                        replies
                      </p>
                    </div>
                    <div>
                      <p className="text-lg font-bold tabular-nums">
                        {thread._count.reactions}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-ink-400">
                        likes
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

function Chip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-volt-500 bg-volt-500 text-[var(--color-accent-fg)]"
          : "border-ink-700 bg-ink-850 text-ink-300 hover:border-ink-600"
      }`}
    >
      {label}
    </Link>
  );
}
