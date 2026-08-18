import type { Metadata } from "next";
import { db } from "@/lib/db";
import { AdminList, AdminBreadcrumb } from "@/components/admin-list";
import { togglePublishAction } from "../actions";
import { PageHeader, ButtonLink } from "@/components/ui";

export const metadata: Metadata = { title: "Programs" };
export const dynamic = "force-dynamic";

export default async function AdminProgramsPage() {
  const programs = await db.program.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { workouts: true } } },
  });

  return (
    <>
      <AdminBreadcrumb
        items={[{ label: "Content", href: "/admin/content" }, { label: "Programs" }]}
      />
      <PageHeader
        title="Training programs"
        description="Each program is a multi-week block. Open one to add the video sessions inside it."
        action={<ButtonLink href="/admin/content/programs/new">New program</ButtonLink>}
      />
      <AdminList
        type="program"
        editBase="/admin/content/programs"
        toggleAction={togglePublishAction}
        newHref="/admin/content/programs/new"
        newLabel="Create your first program"
        emptyTitle="No programs yet"
        emptyDescription="A program is a structured block members follow week by week. Create one, then add its sessions."
        rows={programs.map((p) => ({
          id: p.id,
          title: p.title,
          subtitle: p.subtitle,
          isPublished: p.isPublished,
          minTier: p.minTier,
          meta: `${p._count.workouts} sessions · ${p.weeks} weeks · ${p.level}`,
          viewHref: `/programs/${p.slug}`,
        }))}
      />
    </>
  );
}
