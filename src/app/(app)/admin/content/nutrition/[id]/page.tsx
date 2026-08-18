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
  saveDietPlanAction,
  deleteDietPlanAction,
  saveMealAction,
  deleteMealAction,
} from "../../actions";
import { PageHeader, Card, Badge, ButtonLink, Alert } from "@/components/ui";

export const metadata: Metadata = { title: "Edit diet plan" };
export const dynamic = "force-dynamic";

const GOALS = ["cut", "bulk", "recomp", "maintain"].map((v) => ({ value: v, label: v }));
const SLOTS = ["breakfast", "lunch", "snack", "dinner"].map((v) => ({
  value: v,
  label: v,
}));

export default async function EditDietPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const isNew = id === "new";

  const plan = isNew
    ? null
    : await db.dietPlan.findUnique({
        where: { id },
        include: { meals: { orderBy: [{ dayNumber: "asc" }, { sortOrder: "asc" }] } },
      });
  if (!isNew && !plan) notFound();

  // Show how far each day's meals land from the plan's stated target — a plan
  // whose meals don't add up to its own number is the most common content bug.
  const dayTotals = new Map<number, number>();
  for (const meal of plan?.meals ?? []) {
    dayTotals.set(meal.dayNumber, (dayTotals.get(meal.dayNumber) ?? 0) + meal.kcal);
  }

  return (
    <>
      <AdminBreadcrumb
        items={[
          { label: "Content", href: "/admin/content" },
          { label: "Diet plans", href: "/admin/content/nutrition" },
          { label: isNew ? "New" : plan!.title },
        ]}
      />

      <PageHeader
        title={isNew ? "New diet plan" : plan!.title}
        description={
          isNew
            ? "Set the daily target first. You'll add meals after saving."
            : "Change the targets, then manage the meals below."
        }
        action={
          plan ? (
            <ButtonLink href={`/nutrition/${plan.slug}`} variant="secondary">
              Preview
            </ButtonLink>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <EditorSection title="Plan details" description="Targets and framing.">
            <AdminForm
              action={saveDietPlanAction}
              hiddenFields={{ id: plan?.id }}
              submitLabel={isNew ? "Create diet plan" : "Save changes"}
            >
              <TextField
                label="Title"
                name="title"
                defaultValue={plan?.title}
                placeholder="The 2,200 Cut"
                required
              />
              <TextArea
                label="Description"
                name="description"
                defaultValue={plan?.description}
                rows={3}
                placeholder="Who it's for and how it works."
                required
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Goal"
                  name="goal"
                  options={GOALS}
                  defaultValue={plan?.goal ?? "recomp"}
                />
                <TextField
                  label="Length in days"
                  name="durationDays"
                  type="number"
                  min={1}
                  max={31}
                  defaultValue={plan?.durationDays ?? 7}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-4">
                <TextField
                  label="Calories"
                  name="kcalTarget"
                  type="number"
                  defaultValue={plan?.kcalTarget ?? 2200}
                />
                <TextField
                  label="Protein (g)"
                  name="proteinG"
                  type="number"
                  defaultValue={plan?.proteinG ?? 180}
                />
                <TextField
                  label="Carbs (g)"
                  name="carbsG"
                  type="number"
                  defaultValue={plan?.carbsG ?? 200}
                />
                <TextField
                  label="Fat (g)"
                  name="fatG"
                  type="number"
                  defaultValue={plan?.fatG ?? 70}
                />
              </div>
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
              title={`Meals (${plan.meals.length})`}
              description="Add one row per meal per day. Day 1 repeated is fine — repetition is what makes a plan followable."
            >
              {plan.meals.length === 0 ? (
                <Alert tone="info">
                  No meals yet. Without them the plan shows a target and nothing to
                  eat.
                </Alert>
              ) : (
                <>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {[...dayTotals.entries()]
                      .sort((a, b) => a[0] - b[0])
                      .map(([day, kcal]) => {
                        const diff = kcal - plan.kcalTarget;
                        const off = Math.abs(diff) > 150;
                        return (
                          <Badge key={day} tone={off ? "warning" : "success"}>
                            Day {day}: {kcal} kcal {off ? `(${diff > 0 ? "+" : ""}${diff})` : "✓"}
                          </Badge>
                        );
                      })}
                  </div>

                  <div className="space-y-2">
                    {plan.meals.map((meal) => (
                      <details
                        key={meal.id}
                        className="rounded-xl border border-ink-700 bg-ink-850"
                      >
                        <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3">
                          <span className="text-sm font-medium">{meal.title}</span>
                          <span className="text-xs text-ink-400">
                            Day {meal.dayNumber} · {meal.slot} · {meal.kcal} kcal
                          </span>
                        </summary>
                        <div className="border-t border-ink-700 p-4">
                          <MealFields
                            dietPlanId={plan.id}
                            meal={{
                              id: meal.id,
                              title: meal.title,
                              dayNumber: meal.dayNumber,
                              slot: meal.slot,
                              ingredients: (JSON.parse(meal.ingredients) as string[]).join("\n"),
                              method: meal.method,
                              kcal: meal.kcal,
                              proteinG: meal.proteinG,
                              carbsG: meal.carbsG,
                              fatG: meal.fatG,
                              sortOrder: meal.sortOrder,
                            }}
                          />
                          <div className="mt-4 border-t border-ink-700 pt-4">
                            <DangerForm
                              action={deleteMealAction}
                              hiddenFields={{ id: meal.id, dietPlanId: plan.id }}
                              label="Delete this meal"
                              confirmMessage={`Delete "${meal.title}"?`}
                            />
                          </div>
                        </div>
                      </details>
                    ))}
                  </div>
                </>
              )}

              <div className="mt-5 rounded-xl border border-dashed border-ink-700 p-4">
                <h3 className="mb-3 text-sm font-semibold">Add a meal</h3>
                <MealFields dietPlanId={plan.id} />
              </div>
            </EditorSection>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <h2 className="text-sm font-semibold">Tips</h2>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-ink-400">
              <li>
                · The day badges warn you when a day&apos;s meals miss the plan&apos;s
                own calorie target by more than 150.
              </li>
              <li>· Ingredients go one per line — they become the shopping list.</li>
              <li>· Reusing the same meals across days is a feature, not laziness.</li>
            </ul>
          </Card>

          {plan ? (
            <Card>
              <h2 className="text-sm font-semibold">Danger zone</h2>
              <p className="mb-3 mt-1 text-xs text-ink-400">
                Deletes the plan and all {plan.meals.length} of its meals.
              </p>
              <DangerForm
                action={deleteDietPlanAction}
                hiddenFields={{ id: plan.id }}
                label="Delete diet plan"
                confirmMessage={`Delete "${plan.title}"? This cannot be undone.`}
              />
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

function MealFields({
  dietPlanId,
  meal,
}: {
  dietPlanId: string;
  meal?: {
    id: string;
    title: string;
    dayNumber: number;
    slot: string;
    ingredients: string;
    method: string | null;
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    sortOrder: number;
  };
}) {
  return (
    <AdminForm
      action={saveMealAction}
      hiddenFields={{ dietPlanId, id: meal?.id }}
      submitLabel={meal ? "Save meal" : "Add meal"}
    >
      <TextField
        label="Meal name"
        name="title"
        defaultValue={meal?.title}
        placeholder="Greek yoghurt, oats, berries"
        required
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          label="Day"
          name="dayNumber"
          type="number"
          min={1}
          defaultValue={meal?.dayNumber ?? 1}
        />
        <SelectField
          label="Slot"
          name="slot"
          options={SLOTS}
          defaultValue={meal?.slot ?? "breakfast"}
        />
        <TextField
          label="Sort order"
          name="sortOrder"
          type="number"
          defaultValue={meal?.sortOrder ?? 0}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <TextField label="Calories" name="kcal" type="number" defaultValue={meal?.kcal ?? 0} />
        <TextField
          label="Protein (g)"
          name="proteinG"
          type="number"
          defaultValue={meal?.proteinG ?? 0}
        />
        <TextField
          label="Carbs (g)"
          name="carbsG"
          type="number"
          defaultValue={meal?.carbsG ?? 0}
        />
        <TextField label="Fat (g)" name="fatG" type="number" defaultValue={meal?.fatG ?? 0} />
      </div>
      <TextArea
        label="Ingredients"
        name="ingredients"
        defaultValue={meal?.ingredients}
        rows={4}
        placeholder={"200g Greek yoghurt\n60g oats\n100g mixed berries"}
        hint="One per line. These become the shopping list."
      />
      <TextArea
        label="Method"
        name="method"
        defaultValue={meal?.method}
        rows={2}
        placeholder="How to make it, if it isn't obvious."
      />
    </AdminForm>
  );
}
