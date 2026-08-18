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
  saveProgramAction,
  deleteProgramAction,
  saveWorkoutAction,
  deleteWorkoutAction,
} from "../../actions";
import { formatDuration } from "@/lib/video";
import { PageHeader, Card, Badge, ButtonLink, Alert } from "@/components/ui";

export const metadata: Metadata = { title: "Edit program" };
export const dynamic = "force-dynamic";

const LEVELS = ["beginner", "intermediate", "advanced"].map((v) => ({
  value: v,
  label: v,
}));
const CATEGORIES = ["strength", "recomp", "home", "conditioning", "mobility"].map((v) => ({
  value: v,
  label: v,
}));

export default async function EditProgramPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const isNew = id === "new";

  const program = isNew
    ? null
    : await db.program.findUnique({
        where: { id },
        include: {
          workouts: {
            orderBy: { sortOrder: "asc" },
            include: { videoAsset: true },
          },
        },
      });

  if (!isNew && !program) notFound();

  return (
    <>
      <AdminBreadcrumb
        items={[
          { label: "Content", href: "/admin/content" },
          { label: "Programs", href: "/admin/content/programs" },
          { label: isNew ? "New" : program!.title },
        ]}
      />

      <PageHeader
        title={isNew ? "New program" : program!.title}
        description={
          isNew
            ? "Give it a name and a description. You'll add the sessions next."
            : "Change the details, then manage its sessions below."
        }
        action={
          program ? (
            <ButtonLink href={`/programs/${program.slug}`} variant="secondary">
              Preview
            </ButtonLink>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <EditorSection
            title="Details"
            description="What members see on the program card and page."
          >
            <AdminForm
              action={saveProgramAction}
              hiddenFields={{ id: program?.id }}
              submitLabel={isNew ? "Create program" : "Save changes"}
            >
              <TextField
                label="Title"
                name="title"
                defaultValue={program?.title}
                placeholder="Foundation Strength"
                required
              />
              <TextField
                label="Subtitle"
                name="subtitle"
                defaultValue={program?.subtitle}
                placeholder="8 weeks to a real base"
              />
              <TextArea
                label="Description"
                name="description"
                defaultValue={program?.description}
                rows={4}
                placeholder="Who it's for, what it covers, what they'll need."
                required
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Level"
                  name="level"
                  options={LEVELS}
                  defaultValue={program?.level ?? "beginner"}
                />
                <SelectField
                  label="Category"
                  name="category"
                  options={CATEGORIES}
                  defaultValue={program?.category ?? "strength"}
                />
                <TextField
                  label="Length in weeks"
                  name="weeks"
                  type="number"
                  min={1}
                  max={104}
                  defaultValue={program?.weeks ?? 4}
                />
                <TextField
                  label="Sort order"
                  name="sortOrder"
                  type="number"
                  defaultValue={program?.sortOrder ?? 0}
                  hint="Lower numbers appear first."
                />
              </div>
              <TierField defaultValue={program?.minTier ?? 1} />
              <CheckboxField
                label="Published"
                name="isPublished"
                defaultChecked={program?.isPublished ?? false}
                hint="Unpublished programs are invisible to members."
              />
            </AdminForm>
          </EditorSection>

          {program ? (
            <EditorSection
              title={`Sessions (${program.workouts.length})`}
              description="The individual workouts members follow, in order."
            >
              {program.workouts.length === 0 ? (
                <Alert tone="info">
                  No sessions yet. Add the first one with the form below — a program
                  with no sessions has nothing for a member to do.
                </Alert>
              ) : (
                <div className="space-y-2">
                  {program.workouts.map((w) => (
                    <details key={w.id} className="rounded-xl border border-ink-700 bg-ink-850">
                      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3">
                        <span className="text-sm font-medium">{w.title}</span>
                        <span className="flex items-center gap-2">
                          {w.isFreePreview ? <Badge tone="volt">Free preview</Badge> : null}
                          {!w.videoAsset ? <Badge tone="warning">No video</Badge> : null}
                          <span className="text-xs text-ink-400">
                            W{w.weekNumber} D{w.dayNumber} · {formatDuration(w.durationSec)}
                          </span>
                        </span>
                      </summary>
                      <div className="border-t border-ink-700 p-4">
                        <WorkoutFields
                          programId={program.id}
                          workout={{
                            id: w.id,
                            title: w.title,
                            description: w.description,
                            weekNumber: w.weekNumber,
                            dayNumber: w.dayNumber,
                            durationSec: w.durationSec,
                            equipment: (JSON.parse(w.equipment) as string[]).join(", "),
                            sortOrder: w.sortOrder,
                            isFreePreview: w.isFreePreview,
                            videoUrl: w.videoAsset?.sourceUrl ?? "",
                            videoProvider: w.videoAsset?.provider ?? "local",
                            playbackId: w.videoAsset?.playbackId ?? "",
                          }}
                        />
                        <div className="mt-4 border-t border-ink-700 pt-4">
                          <DangerForm
                            action={deleteWorkoutAction}
                            hiddenFields={{ id: w.id, programId: program.id }}
                            label="Delete this session"
                            confirmMessage={`Delete "${w.title}"? This cannot be undone.`}
                          />
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
              )}

              <div className="mt-5 rounded-xl border border-dashed border-ink-700 p-4">
                <h3 className="mb-3 text-sm font-semibold">Add a session</h3>
                <WorkoutFields programId={program.id} />
              </div>
            </EditorSection>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <h2 className="text-sm font-semibold">Tips</h2>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-ink-400">
              <li>
                · Mark the first session as a free preview. It converts far better
                than a description does.
              </li>
              <li>
                · Sort order controls the sequence members follow — set it before
                you publish.
              </li>
              <li>
                · A session with no video still shows in the list. Members will
                notice.
              </li>
            </ul>
          </Card>

          {program ? (
            <Card>
              <h2 className="text-sm font-semibold">Danger zone</h2>
              <p className="mb-3 mt-1 text-xs text-ink-400">
                Deleting removes the program and all its sessions, and any progress
                members recorded against them.
              </p>
              <DangerForm
                action={deleteProgramAction}
                hiddenFields={{ id: program.id }}
                label="Delete program"
                confirmMessage={`Delete "${program.title}" and all ${program.workouts.length} of its sessions? This cannot be undone.`}
              />
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

function WorkoutFields({
  programId,
  workout,
}: {
  programId: string;
  workout?: {
    id: string;
    title: string;
    description: string | null;
    weekNumber: number;
    dayNumber: number;
    durationSec: number;
    equipment: string;
    sortOrder: number;
    isFreePreview: boolean;
    videoUrl: string;
    videoProvider: string;
    playbackId: string;
  };
}) {
  return (
    <AdminForm
      action={saveWorkoutAction}
      hiddenFields={{ programId, id: workout?.id }}
      submitLabel={workout ? "Save session" : "Add session"}
    >
      <TextField
        label="Session title"
        name="title"
        defaultValue={workout?.title}
        placeholder="Week 1 — Squat pattern & bracing"
        required
      />
      <TextArea
        label="Description"
        name="description"
        defaultValue={workout?.description}
        rows={2}
        placeholder="What the session covers."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          label="Week"
          name="weekNumber"
          type="number"
          min={1}
          defaultValue={workout?.weekNumber ?? 1}
        />
        <TextField
          label="Day"
          name="dayNumber"
          type="number"
          min={1}
          defaultValue={workout?.dayNumber ?? 1}
        />
        <TextField
          label="Length (seconds)"
          name="durationSec"
          type="number"
          min={0}
          defaultValue={workout?.durationSec ?? 0}
        />
      </div>
      <TextField
        label="Equipment"
        name="equipment"
        defaultValue={workout?.equipment}
        placeholder="Barbell, Rack, Bench"
        hint="Separate with commas."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          label="Video host"
          name="videoProvider"
          defaultValue={workout?.videoProvider ?? "local"}
          options={[
            { value: "local", label: "Direct URL" },
            { value: "mux", label: "Mux" },
            { value: "cloudflare", label: "Cloudflare Stream" },
          ]}
        />
        <TextField
          label="Video URL"
          name="videoUrl"
          defaultValue={workout?.videoUrl}
          placeholder="https://…/session.mp4"
          hint="Used when the host is Direct URL."
        />
        <TextField
          label="Playback ID"
          name="playbackId"
          defaultValue={workout?.playbackId}
          hint="Used by Mux / Cloudflare."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Sort order"
          name="sortOrder"
          type="number"
          defaultValue={workout?.sortOrder ?? 0}
        />
        <CheckboxField
          label="Free preview"
          name="isFreePreview"
          defaultChecked={workout?.isFreePreview ?? false}
          hint="Watchable even without the plan."
        />
      </div>
    </AdminForm>
  );
}
