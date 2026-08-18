import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { entitlementFor } from "@/lib/entitlements";
import { ReplyForm } from "@/components/exchange-forms";
import { createReplyAction, toggleReactionAction } from "../actions";
import { PageHeader, Badge, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const thread = await db.thread.findUnique({ where: { slug } });
  return { title: thread?.title ?? "Thread" };
}

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const thread = await db.thread.findUnique({
    where: { slug },
    include: {
      author: true,
      category: true,
      reactions: true,
      posts: {
        orderBy: { createdAt: "asc" },
        include: { author: true, reactions: true },
      },
    },
  });
  if (!thread) notFound();

  await db.thread.update({
    where: { id: thread.id },
    data: { viewCount: { increment: 1 } },
  });

  const entitlement = entitlementFor(user.subscriptions);
  const canReply = entitlement.tier >= 1 && !thread.isLocked;
  const likedThread = thread.reactions.some((r) => r.userId === user.id);

  return (
    <>
      <Link href="/exchange" className="text-sm text-ink-400 hover:text-ink-100">
        ← Exchange
      </Link>

      <div className="mt-4 max-w-3xl">
        <div className="mb-3 flex flex-wrap gap-2">
          {thread.isPinned ? <Badge tone="volt">Pinned</Badge> : null}
          {thread.category ? <Badge>{thread.category.name}</Badge> : null}
          {thread.isLocked ? <Badge tone="warning">Locked</Badge> : null}
        </div>

        <PageHeader
          title={thread.title}
          description={`${thread.author.name} · ${thread.createdAt.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })} · ${thread.viewCount} views`}
        />

        <Card>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-200">
            {thread.body}
          </p>
          <div className="mt-4 border-t border-ink-800 pt-3">
            <LikeButton
              count={thread.reactions.length}
              liked={likedThread}
              threadId={thread.id}
              slug={thread.slug}
            />
          </div>
        </Card>

        <h2 className="mb-3 mt-8 text-base font-semibold">
          {thread.posts.length} {thread.posts.length === 1 ? "reply" : "replies"}
        </h2>

        <div className="space-y-3">
          {thread.posts.map((post) => (
            <div
              key={post.id}
              className={`card p-5 ${post.isCoachAnswer ? "border-volt-500/40" : ""}`}
            >
              <div className="mb-2.5 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{post.author.name}</span>
                {post.isCoachAnswer ? <Badge tone="volt">Coach</Badge> : null}
                <span className="text-xs text-ink-400">
                  {post.createdAt.toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-300">
                {post.body}
              </p>
              <div className="mt-3">
                <LikeButton
                  count={post.reactions.length}
                  liked={post.reactions.some((r) => r.userId === user.id)}
                  postId={post.id}
                  slug={thread.slug}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <ReplyForm
            threadId={thread.id}
            action={createReplyAction}
            canReply={canReply}
          />
        </div>
      </div>
    </>
  );
}

function LikeButton({
  count,
  liked,
  postId,
  threadId,
  slug,
}: {
  count: number;
  liked: boolean;
  postId?: string;
  threadId?: string;
  slug: string;
}) {
  return (
    <form action={toggleReactionAction}>
      {postId ? <input type="hidden" name="postId" value={postId} /> : null}
      {threadId ? <input type="hidden" name="threadId" value={threadId} /> : null}
      <input type="hidden" name="slug" value={slug} />
      <button
        type="submit"
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
          liked
            ? "border-volt-500/40 bg-volt-500/15 text-volt-500"
            : "border-ink-700 text-ink-400 hover:text-ink-100"
        }`}
      >
        ▲ {count}
      </button>
    </form>
  );
}
