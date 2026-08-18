import type { Metadata } from "next";
import { db } from "@/lib/db";
import { AdminList, AdminBreadcrumb } from "@/components/admin-list";
import { togglePublishAction } from "../actions";
import { PageHeader, ButtonLink } from "@/components/ui";

export const metadata: Metadata = { title: "Diet plans" };
export const dynamic = "force-dynamic";

export default async function AdminNutritionPage() {
  const plans = await db.dietPlan.findMany({
    orderBy: { kcalTarget: "asc" },
    include: { _count: { select: { meals: true } } },
  });

  return (
    <>
      <AdminBreadcrumb
        items={[{ label: "Content", href: "/admin/content" }, { label: "Diet plans" }]}
      />
      <PageHeader
        title="Diet plans"
        description="Open a plan to add its meals. The day totals members see are calculated from those meals."
        action={<ButtonLink href="/admin/content/nutrition/new">New diet plan</ButtonLink>}
      />
      <AdminList
        type="diet"
        editBase="/admin/content/nutrition"
        toggleAction={togglePublishAction}
        newHref="/admin/content/nutrition/new"
        newLabel="Create your first diet plan"
        emptyTitle="No diet plans yet"
        emptyDescription="A diet plan sets a calorie and macro target, then lays out the meals that hit it."
        rows={plans.map((p) => ({
          id: p.id,
          title: p.title,
          subtitle: p.description.slice(0, 100),
          isPublished: p.isPublished,
          minTier: p.minTier,
          meta: `${p.kcalTarget} kcal · ${p.proteinG}P/${p.carbsG}C/${p.fatG}F · ${p._count.meals} meals`,
          viewHref: `/nutrition/${p.slug}`,
        }))}
      />
    </>
  );
}
