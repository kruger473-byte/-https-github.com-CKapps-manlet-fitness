"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Alert, Button } from "./ui";
import type { GrowthState } from "@/app/(app)/admin/growth/actions";

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function TrackedLinkForm({
  action,
  channels,
}: {
  action: (prev: GrowthState, formData: FormData) => Promise<GrowthState>;
  channels: Array<{ id: string; label: string }>;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="slug" className="mb-1.5 block text-xs font-medium text-ink-300">
            Slug
          </label>
          <input
            id="slug"
            name="slug"
            placeholder="ig-bio-oct"
            className="input"
            required
          />
        </div>
        <div>
          <label
            htmlFor="destination"
            className="mb-1.5 block text-xs font-medium text-ink-300"
          >
            Sends people to
          </label>
          <input
            id="destination"
            name="destination"
            defaultValue="/pricing"
            className="input"
            required
          />
        </div>
        <div>
          <label
            htmlFor="channelId"
            className="mb-1.5 block text-xs font-medium text-ink-300"
          >
            Channel
          </label>
          <select id="channelId" name="channelId" className="input">
            <option value="">Unassigned</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="campaign"
            className="mb-1.5 block text-xs font-medium text-ink-300"
          >
            Campaign
          </label>
          <input
            id="campaign"
            name="campaign"
            placeholder="reel-squat-cues"
            className="input"
          />
        </div>
      </div>

      <div>
        <label htmlFor="note" className="mb-1.5 block text-xs font-medium text-ink-300">
          Note (optional)
        </label>
        <input
          id="note"
          name="note"
          placeholder="Which post this went in"
          className="input"
        />
      </div>

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.notice ? <Alert tone="success">{state.notice}</Alert> : null}

      <Submit label="Create link" pendingLabel="Creating…" />
    </form>
  );
}

export function AddChannelForm({
  action,
}: {
  action: (prev: GrowthState, formData: FormData) => Promise<GrowthState>;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="platform" className="mb-1.5 block text-xs font-medium text-ink-300">
          Platform
        </label>
        <select id="platform" name="platform" className="input" required>
          {["INSTAGRAM", "META", "TIKTOK", "GOOGLE", "YOUTUBE", "EMAIL"].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="handle" className="mb-1.5 block text-xs font-medium text-ink-300">
          Handle
        </label>
        <input id="handle" name="handle" placeholder="@yourhandle" className="input" required />
      </div>
      <div>
        <label
          htmlFor="displayName"
          className="mb-1.5 block text-xs font-medium text-ink-300"
        >
          Label (optional)
        </label>
        <input
          id="displayName"
          name="displayName"
          placeholder="Instagram — main"
          className="input"
        />
      </div>

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.notice ? <Alert tone="success">{state.notice}</Alert> : null}

      <Submit label="Add channel" pendingLabel="Adding…" />
    </form>
  );
}

export function TestConversionForm({
  action,
}: {
  action: (prev: GrowthState, formData: FormData) => Promise<GrowthState>;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction}>
      <p className="mb-3 text-xs text-ink-400">
        Sends a test LEAD event through Meta, TikTok and Google using the credentials
        currently configured, and reports exactly what each one said.
      </p>
      {state.error ? (
        <div className="mb-3">
          <Alert tone="danger">{state.error}</Alert>
        </div>
      ) : null}
      {state.notice ? (
        <div className="mb-3">
          <Alert tone="info">{state.notice}</Alert>
        </div>
      ) : null}
      <Submit label="Send test conversion" pendingLabel="Sending…" />
    </form>
  );
}

export function CopyField({ value }: { value: string }) {
  return (
    <button
      type="button"
      onClick={() => void navigator.clipboard?.writeText(value)}
      title="Copy to clipboard"
      className="rounded-md border border-ink-700 bg-ink-850 px-2 py-1 font-mono text-xs text-ink-300 transition-colors hover:border-volt-500/40 hover:text-ink-100"
    >
      {value}
    </button>
  );
}
