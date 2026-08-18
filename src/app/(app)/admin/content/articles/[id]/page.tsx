import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { AdminBreadcrumb, EditorSection } from "@/components/admin-list";
import {
  AdminForm,
  TextField,
  TextArea,
  SelectField,
  CheckboxField,
  TierField,
  DangerForm,
} from "@/components/admin-forms";
import { saveArticleAction, deleteArticleAction } from "../../actions";
import { PageHeader, Card, ButtonLink } from "@/components/ui";

export const metadata: Metadata = { title: "Edit article" };
export const dynamic = "force-dynamic";

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const isNew = id === "new";

  const [article, categories] = await Promise.all([
    isNew ? null : db.article.findUnique({ where: { id } }),
    db.category.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  if (!isNew && !article) notFound();

  return (
    <>
      <AdminBreadcrumb
        items={[
          { label: "Content", href: "/admin/content" },
          { label: "Knowledge base", href: "/admin/content/articles" },
          { label: isNew ? "New" : article!.title },
        ]}
      />

      <PageHeader
        title={isNew ? "New article" : article!.title}
        description="Reading time is calculated from the body, so you don't have to guess it."
        action={
          article ? (
            <ButtonLink href={`/knowledge/${article.slug}`} variant="secondary">
              Preview
            </ButtonLink>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EditorSection title="Article">
            <AdminForm
              action={saveArticleAction}
              hiddenFields={{ id: article?.id }}
              submitLabel={isNew ? "Create article" : "Save changes"}
            >
              <TextField
                label="Title"
                name="title"
                defaultValue={article?.title}
                placeholder="How many sets you actually need"
                required
              />
              <TextArea
                label="Summary"
                name="excerpt"
                defaultValue={article?.excerpt}
                rows={2}
                placeholder="One or two sentences. Shown in listings and search results."
                required
              />
              <TextArea
                label="Body"
                name="body"
                defaultValue={article?.body}
                rows={18}
                placeholder={
                  "Write in plain paragraphs.\n\n## Use two hashes for a heading\n\n- Start a line with a dash for a bullet\n- Like this"
                }
                required
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Category"
                  name="categoryId"
                  defaultValue={article?.categoryId ?? ""}
                  options={[
                    { value: "", label: "Uncategorised" },
                    ...categories.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
                <TierField defaultValue={article?.minTier ?? 0} />
              </div>
              <CheckboxField
                label="Published"
                name="isPublished"
                defaultChecked={article?.isPublished ?? false}
              />
            </AdminForm>
          </EditorSection>
        </div>

        <div className="space-y-4">
          <Card>
            <h2 className="text-sm font-semibold">Formatting</h2>
            <p className="mt-2 text-xs text-ink-400">
              The body supports a small subset of Markdown, deliberately:
            </p>
            <ul className="mt-2 space-y-1.5 text-xs text-ink-400">
              <li>
                · <code className="text-ink-300">## Heading</code> for a section
              </li>
              <li>
                · <code className="text-ink-300">- item</code> for bullets
              </li>
              <li>· A blank line starts a new paragraph</li>
            </ul>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold">Free vs paid</h2>
            <p className="mt-2 text-xs leading-relaxed text-ink-400">
              Make the genuinely useful basics free — they earn search traffic and
              trust. Keep the material that only makes sense once someone is training
              seriously behind the plan.
            </p>
          </Card>

          {article ? (
            <Card>
              <h2 className="text-sm font-semibold">Danger zone</h2>
              <p className="mb-3 mt-1 text-xs text-ink-400">
                Deleting is permanent and breaks any link to this article.
              </p>
              <DangerForm
                action={deleteArticleAction}
                hiddenFields={{ id: article.id }}
                label="Delete article"
                confirmMessage={`Delete "${article.title}"? This cannot be undone.`}
              />
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
