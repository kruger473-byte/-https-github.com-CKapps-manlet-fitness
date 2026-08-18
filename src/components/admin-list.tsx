import Link from "next/link";
import type { ReactNode } from "react";
import { PublishToggle } from "./admin-forms";
import { Card, Badge, EmptyState, ButtonLink } from "./ui";
import { tierLabel } from "@/lib/entitlements";

export type AdminListRow = {
  id: string;
  title: string;
  subtitle?: string | null;
  isPublished: boolean;
  minTier: number;
  meta?: string;
  viewHref?: string;
};

/**
 * The list view every content type shares: title, who can see it, live/draft
 * toggle, and links to edit or preview.
 */
export function AdminList({
  rows,
  editBase,
  type,
  toggleAction,
  emptyTitle,
  emptyDescription,
  newHref,
  newLabel,
}: {
  rows: AdminListRow[];
  editBase: string;
  type: string;
  toggleAction: (formData: FormData) => Promise<void>;
  emptyTitle: string;
  emptyDescription: string;
  newHref: string;
  newLabel: string;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={<ButtonLink href={newHref}>{newLabel}</ButtonLink>}
      />
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <Card key={row.id} className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`${editBase}/${row.id}`}
                className="text-sm font-semibold hover:text-volt-500"
              >
                {row.title}
              </Link>
              <Badge tone={row.minTier === 0 ? "success" : "neutral"}>
                {row.minTier === 0 ? "Free" : tierLabel(row.minTier)}
              </Badge>
            </div>
            {row.subtitle ? (
              <p className="mt-1 truncate text-xs text-ink-400">{row.subtitle}</p>
            ) : null}
            {row.meta ? <p className="mt-1 text-xs text-ink-400">{row.meta}</p> : null}
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <PublishToggle
              action={toggleAction}
              type={type}
              id={row.id}
              isPublished={row.isPublished}
            />
            {row.viewHref ? (
              <Link
                href={row.viewHref}
                className="text-xs text-ink-400 transition-colors hover:text-ink-100"
              >
                Preview
              </Link>
            ) : null}
            <Link
              href={`${editBase}/${row.id}`}
              className="text-xs font-medium text-volt-500 hover:underline"
            >
              Edit
            </Link>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function AdminBreadcrumb({
  items,
}: {
  items: Array<{ label: string; href?: string }>;
}) {
  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-ink-400">
      {items.map((item, i) => (
        <span key={item.label} className="flex items-center gap-1.5">
          {i > 0 ? <span aria-hidden="true">/</span> : null}
          {item.href ? (
            <Link href={item.href} className="transition-colors hover:text-ink-100">
              {item.label}
            </Link>
          ) : (
            <span className="text-ink-300">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function EditorSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <h2 className="text-base font-semibold">{title}</h2>
      {description ? <p className="mb-4 mt-1 text-sm text-ink-400">{description}</p> : <div className="mb-4" />}
      {children}
    </Card>
  );
}
