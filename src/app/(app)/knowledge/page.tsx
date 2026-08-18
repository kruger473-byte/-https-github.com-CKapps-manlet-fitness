import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { entitlementFor } from "@/lib/entitlements";
import { PageHeader, Badge, LockBadge, EmptyState, ButtonLink } from "@/components/ui";

export const metadata: Metadata = { title: "Knowledge base" };
export const dynamic = "force-dynamic";

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q, category } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const entitlement = entitlementFor(user.subscriptions);

  const query = (q ?? "").trim();

  const [articles, categories] = await Promise.all([
    db.article.findMany({
      where: {
        isPublished: true,
        ...(category ? { category: { slug: category } } : {}),
        ...(query
          ? {
              OR: [
                { title: { contains: query } },
                { excerpt: { contains: query } },
                { body: { contains: query } },
              ],
            }
          : {}),
      },
      include: { category: true },
      orderBy: [{ minTier: "asc" }, { publishedAt: "desc" }],
    }),
    db.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { articles: true } } },
    }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Knowledge base"
        title="Answers, written once"
        description="The searchable version of every question worth asking. Start with the basics; the deeper material is there when you need it."
      />

      <form className="mb-6" action="/knowledge">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search — try 'protein', 'soreness', 'sets'…"
          className="input"
          aria-label="Search the knowledge base"
        />
      </form>

      <div className="mb-6 flex flex-wrap gap-2">
        <FilterChip href="/knowledge" label="All" active={!category} />
        {categories.map((c) => (
          <FilterChip
            key={c.id}
            href={`/knowledge?category=${c.slug}`}
            label={`${c.name} (${c._count.articles})`}
            active={category === c.slug}
          />
        ))}
      </div>

      {articles.length === 0 ? (
        <EmptyState
          title="Nothing matched that"
          description={
            query
              ? `No article mentions "${query}" yet. Try a broader term, or ask in the member exchange.`
              : "No articles in this category yet."
          }
          action={<ButtonLink href="/exchange">Ask the community</ButtonLink>}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {articles.map((article) => {
            const locked = entitlement.tier < article.minTier;
            return (
              <Link
                key={article.id}
                href={`/knowledge/${article.slug}`}
                className="card flex flex-col p-5 transition-colors hover:border-volt-500/40"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h2 className="text-base font-semibold">{article.title}</h2>
                  {locked ? <LockBadge tier={article.minTier} /> : null}
                </div>
                <p className="flex-1 text-sm leading-relaxed text-ink-400">
                  {article.excerpt}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {article.category ? <Badge>{article.category.name}</Badge> : null}
                  <span className="text-xs text-ink-400">
                    {article.readMinutes} min read
                  </span>
                  {article.minTier === 0 ? <Badge tone="success">Free</Badge> : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

function FilterChip({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-volt-500 bg-volt-500 text-ink-950"
          : "border-ink-700 bg-ink-850 text-ink-300 hover:border-ink-600"
      }`}
    >
      {label}
    </Link>
  );
}
