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
import {
  saveSupplementPlanAction,
  deleteSupplementPlanAction,
  saveSupplementItemAction,
  deleteSupplementItemAction,
} from "../../actions";
import { formatMoney } from "@/lib/entitlements";
import { PageHeader, Card, Badge, ButtonLink, Alert } from "@/components/ui";

export const metadata: Metadata = { title: "Edit supplement plan" };
export const dynamic = "force-dynamic";

const GOALS = ["general", "strength", "cut", "recovery", "sleep"].map((v) => ({
  value: v,
  label: v,
}));
const TIERS = [
  { value: "core", label: "Core — solid evidence, take it consistently" },
  { value: "optional", label: "Optional — small or uncertain effect" },
  { value: "situational", label: "Situational — only in specific cases" },
];

export default async function EditSupplementPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const isNew = id === "new";

  const plan = isNew
    ? null
    : await db.supplementPlan.findUnique({
        where: { id },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      });
  if (!isNew && !plan) notFound();

  const coreCost =
    plan?.items
      .filter((i) => i.tier === "core")
      .reduce((n, i) => n + i.monthlyCostCents, 0) ?? 0;

  return (
    <>
      <AdminBreadcrumb
        items={[
          { label: "Content", href: "/admin/content" },
          { label: "Supplement plans", href: "/admin/content/supplements" },
          { label: isNew ? "New" : plan!.title },
        ]}
      />

      <PageHeader
        title={isNew ? "New supplement plan" : plan!.title}
        description={
          isNew
            ? "Name the plan and say who it's for. Items come next."
            : "Edit the plan, then manage its items below."
        }
        action={
          plan ? (
            <ButtonLink href={`/supplements/${plan.slug}`} variant="secondary">
              Preview
            </ButtonLink>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <EditorSection title="Plan details">
            <AdminForm
              action={saveSupplementPlanAction}
              hiddenFields={{ id: plan?.id }}
              submitLabel={isNew ? "Create plan" : "Save changes"}
            >
              <TextField
                label="Title"
                name="title"
                defaultValue={plan?.title}
                placeholder="The short, boring list"
                required
              />
              <TextArea
                label="Description"
                name="description"
                defaultValue={plan?.description}
                rows={3}
                required
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Goal"
                  name="goal"
                  options={GOALS}
                  defaultValue={plan?.goal ?? "general"}
                />
                <TextField
                  label="Sort order"
                  name="sortOrder"
                  type="number"
                  defaultValue={plan?.sortOrder ?? 0}
                />
              </div>
              <TextArea
                label="Disclaimer"
                name="disclaimer"
                defaultValue={plan?.disclaimer}
                rows={2}
                hint="Shown prominently above the items. Keep it honest."
              />
              <TierField defaultValue={plan?.minTier ?? 1} />
              <CheckboxField
                label="Published"
                name="isPublished"
                defaultChecked={plan?.isPublished ?? false}
              />
            </AdminForm>
          </EditorSection>

          {plan ? (
            <EditorSection
              title={`Items (${plan.items.length})`}
              description="Grade each one honestly. The evidence note is what separates this from an affiliate list."
            >
              {plan.items.length === 0 ? (
                <Alert tone="info">No items yet. Add the first one below.</Alert>
              ) : (
                <div className="space-y-2">
                  {plan.items.map((item) => (
                    <details
                      key={item.id}
                      className="rounded-xl border border-ink-700 bg-ink-850"
                    >
                      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3">
                        <span className="text-sm font-medium">{item.name}</span>
                        <span className="flex items-center gap-2">
                          <Badge tone={item.tier === "core" ? "volt" : "neutral"}>
                            {item.tier}
                          </Badge>
                          <span className="text-xs text-ink-400">{item.dose}</span>
                        </span>
                      </summary>
                      <div className="border-t border-ink-700 p-4">
                        <ItemFields
                          planId={plan.id}
                          item={{
                            id: item.id,
                            name: item.name,
                            dose: item.dose,
                            timing: item.timing,
                            purpose: item.purpose,
                            evidenceNote: item.evidenceNote,
                            tier: item.tier,
                            monthlyCost: (item.monthlyCostCents / 100).toFixed(2),
                            sortOrder: item.sortOrder,
                          }}
                        />
                        <div className="mt-4 border-t border-ink-700 pt-4">
                          <DangerForm
                            action={deleteSupplementItemAction}
                            hiddenFields={{ id: item.id, supplementPlanId: plan.id }}
                            label="Delete this item"
                            confirmMessage={`Delete "${item.name}"?`}
                          />
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
              )}

              <div className="mt-5 rounded-xl border border-dashed border-ink-700 p-4">
                <h3 className="mb-3 text-sm font-semibold">Add an item</h3>
                <ItemFields planId={plan.id} />
              </div>
            </EditorSection>
          ) : null}
        </div>

        <div className="space-y-4">
          {plan && coreCost > 0 ? (
            <Card>
              <h2 className="text-sm font-semibold">Core stack cost</h2>
              <p className="mt-2 text-2xl font-bold tabular-nums text-volt-500">
                {formatMoney(coreCost)}
                <span className="text-xs font-normal text-ink-400">/month</span>
              </p>
              <p className="mt-1 text-xs text-ink-400">
                Shown to members so the plan is honest about what it costs to follow.
              </p>
            </Card>
          ) : null}

          <Card>
            <h2 className="text-sm font-semibold">Keep it credible</h2>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-ink-400">
              <li>
                · A short list with honest grading builds more trust than a long one.
              </li>
              <li>
                · The evidence note is deliberately separate from the purpose, so a
                claim and its support never blur together.
              </li>
              <li>· If something has weak evidence, mark it optional and say so.</li>
            </ul>
          </Card>

          {plan ? (
            <Card>
              <h2 className="text-sm font-semibold">Danger zone</h2>
              <p className="mb-3 mt-1 text-xs text-ink-400">
                Deletes the plan and its {plan.items.length} items.
              </p>
              <DangerForm
                action={deleteSupplementPlanAction}
                hiddenFields={{ id: plan.id }}
                label="Delete plan"
                confirmMessage={`Delete "${plan.title}"? This cannot be undone.`}
              />
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

function ItemFields({
  planId,
  item,
}: {
  planId: string;
  item?: {
    id: string;
    name: string;
    dose: string;
    timing: string;
    purpose: string;
    evidenceNote: string | null;
    tier: string;
    monthlyCost: string;
    sortOrder: number;
  };
}) {
  return (
    <AdminForm
      action={saveSupplementItemAction}
      hiddenFields={{ supplementPlanId: planId, id: item?.id }}
      submitLabel={item ? "Save item" : "Add item"}
    >
      <TextField
        label="Name"
        name="name"
        defaultValue={item?.name}
        placeholder="Creatine monohydrate"
        required
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Dose" name="dose" defaultValue={item?.dose} placeholder="5g" />
        <TextField
          label="Timing"
          name="timing"
          defaultValue={item?.timing}
          placeholder="daily, any time"
        />
      </div>
      <TextArea
        label="What it's for"
        name="purpose"
        defaultValue={item?.purpose}
        rows={2}
        placeholder="Small but reliable increase in strength and training volume."
      />
      <TextArea
        label="What the evidence says"
        name="evidenceNote"
        defaultValue={item?.evidenceNote}
        rows={3}
        hint="Shown in its own box. Say how strong the evidence is, and where it doesn't apply."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          label="Grade"
          name="tier"
          options={TIERS}
          defaultValue={item?.tier ?? "core"}
        />
        <TextField
          label="Cost per month"
          name="monthlyCost"
          type="number"
          step="0.01"
          min={0}
          defaultValue={item?.monthlyCost ?? "0"}
          hint="In your currency, e.g. 8.00"
        />
        <TextField
          label="Sort order"
          name="sortOrder"
          type="number"
          defaultValue={item?.sortOrder ?? 0}
        />
      </div>
    </AdminForm>
  );
}
