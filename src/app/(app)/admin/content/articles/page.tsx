import type { Metadata } from "next";
import { db } from "@/lib/db";
import { AdminList, AdminBreadcrumb } from "@/components/admin-list";
import { togglePublishAction } from "../actions";
import { PageHeader, ButtonLink } from "@/components/ui";

export const metadata: Metadata = { title: "Knowledge base" };
export const dynamic = "force-dynamic";

export default async function AdminArticlesPage() {
  const articles = await db.article.findMany({
    orderBy: [{ minTier: "asc" }, { publishedAt: "desc" }],
    include: { category: true },
  });

  return (
    <>
      <AdminBreadcrumb
        items={[{ label: "Content", href: "/admin/content" }, { label: "Knowledge base" }]}
      />
      <PageHeader
        title="Knowledge base"
        description="Free articles are the top of your funnel — they bring people in from search. Deeper material sits behind the plan."
        action={<ButtonLink href="/admin/content/articles/new">New article</ButtonLink>}
      />
      <AdminList
        type="article"
        editBase="/admin/content/articles"
        toggleAction={togglePublishAction}
        newHref="/admin/content/articles/new"
        newLabel="Write your first article"
        emptyTitle="No articles yet"
        emptyDescription="Write the answer to every question you get asked twice. It compounds."
        rows={articles.map((a) => ({
          id: a.id,
          title: a.title,
          subtitle: a.excerpt,
          isPublished: a.isPublished,
          minTier: a.minTier,
          meta: `${a.category?.name ?? "Uncategorised"} · ${a.readMinutes} min · ${a.viewCount} views`,
          viewHref: `/knowledge/${a.slug}`,
        }))}
      />
    </>
  );
}
