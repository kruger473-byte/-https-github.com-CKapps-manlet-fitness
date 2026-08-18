import type { Metadata } from "next";
import { db } from "@/lib/db";
import { AdminList, AdminBreadcrumb } from "@/components/admin-list";
import { togglePublishAction } from "../actions";
import { PageHeader, ButtonLink } from "@/components/ui";

export const metadata: Metadata = { title: "Supplement plans" };
export const dynamic = "force-dynamic";

export default async function AdminSupplementsPage() {
  const plans = await db.supplementPlan.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { items: true } } },
  });

  return (
    <>
      <AdminBreadcrumb
        items={[
          { label: "Content", href: "/admin/content" },
          { label: "Supplement plans" },
        ]}
      />
      <PageHeader
        title="Supplement plans"
        description="Items are graded core, optional or situational, each with a separate note on what the evidence actually supports."
        action={
          <ButtonLink href="/admin/content/supplements/new">New supplement plan</ButtonLink>
        }
      />
      <AdminList
        type="supplement"
        editBase="/admin/content/supplements"
        toggleAction={togglePublishAction}
        newHref="/admin/content/supplements/new"
        newLabel="Create your first supplement plan"
        emptyTitle="No supplement plans yet"
        emptyDescription="A supplement plan is a short list of things worth taking, with honest notes about the evidence."
        rows={plans.map((p) => ({
          id: p.id,
          title: p.title,
          subtitle: p.description.slice(0, 100),
          isPublished: p.isPublished,
          minTier: p.minTier,
          meta: `${p._count.items} items · ${p.goal}`,
          viewHref: `/supplements/${p.slug}`,
        }))}
      />
    </>
  );
}
