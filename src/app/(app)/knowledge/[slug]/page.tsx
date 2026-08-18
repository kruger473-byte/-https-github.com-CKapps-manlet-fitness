import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { accessContextFor, canAccessContent } from "@/lib/entitlements";
import { PageHeader, Badge, ButtonLink, Card, LockIcon } from "@/components/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await db.article.findUnique({ where: { slug } });
  return {
    title: article?.title ?? "Article",
    description: article?.excerpt,
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const article = await db.article.findUnique({
    where: { slug },
    include: { category: true },
  });
  if (!article || !article.isPublished) notFound();

  const { entitlement, accessKeys } = await accessContextFor(user);
  const locked = !canAccessContent(entitlement, accessKeys, {
    type: "ARTICLE",
    id: article.id,
    minTier: article.minTier,
  });

  if (!locked) {
    await db.article.update({
      where: { id: article.id },
      data: { viewCount: { increment: 1 } },
    });
  }

  const related = await db.article.findMany({
    where: {
      isPublished: true,
      categoryId: article.categoryId,
      id: { not: article.id },
    },
    take: 3,
  });

  return (
    <>
      <Link href="/knowledge" className="text-sm text-ink-400 hover:text-ink-100">
        ← Knowledge base
      </Link>

      <article className="mt-4 max-w-3xl">
        <PageHeader
          eyebrow={article.category?.name}
          title={article.title}
          description={article.excerpt}
        />

        <div className="mb-8 flex flex-wrap items-center gap-3 text-xs text-ink-400">
          <span>{article.readMinutes} min read</span>
          <span>·</span>
          <span>
            {article.publishedAt.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
          {article.minTier === 0 ? <Badge tone="success">Free</Badge> : null}
        </div>

        {locked ? (
          <Card className="border-volt-500/30 text-center">
            <LockIcon className="mx-auto h-8 w-8 text-volt-500" />
            <h2 className="mt-3 text-base font-semibold">
              This one is for {article.minTier >= 2 ? "Elite" : "Core"} members
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-400">
              The introduction above is the honest summary. The full article covers the
              detail and the exceptions.
            </p>
            <ButtonLink href="/account/billing" className="mt-5">
              Unlock the knowledge base
            </ButtonLink>
          </Card>
        ) : (
          <div className="prose-body">
            {renderBody(article.body)}
          </div>
        )}
      </article>

      {related.length > 0 ? (
        <section className="mt-12 max-w-3xl">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-400">
            Related
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {related.map((r) => (
              <Link
                key={r.id}
                href={`/knowledge/${r.slug}`}
                className="card p-4 text-sm transition-colors hover:border-volt-500/40"
              >
                {r.title}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

/**
 * Minimal markdown rendering for article bodies: headings, bullets and
 * paragraphs. Content is authored in-house, and keeping this small avoids
 * shipping a markdown parser plus a sanitiser to every reader.
 */
function renderBody(body: string) {
  const blocks = body.split("\n\n");
  return blocks.map((block, i) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith("## ")) {
      return <h2 key={i}>{trimmed.slice(3)}</h2>;
    }
    if (trimmed.startsWith("- ")) {
      return (
        <ul key={i}>
          {trimmed
            .split("\n")
            .filter((l) => l.trim().startsWith("- "))
            .map((l, j) => (
              <li key={j}>{l.trim().slice(2)}</li>
            ))}
        </ul>
      );
    }
    return <p key={i}>{trimmed}</p>;
  });
}
