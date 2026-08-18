"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Alert, Button } from "./ui";
import type { SettingsState } from "@/app/(app)/admin/settings/actions";

type Action = (prev: SettingsState, formData: FormData) => Promise<SettingsState>;

export type BrandingValues = {
  brandName: string;
  monogram: string;
  logoUrl: string | null;
  tagline: string;
  metaDescription: string;
  accentColor: string;
  canonicalUrl: string;
  supportEmail: string;
};

const PRESET_COLORS = [
  "#c8f31d",
  "#38bdf8",
  "#f97316",
  "#ec4899",
  "#a78bfa",
  "#22c55e",
  "#ef4444",
  "#facc15",
];

function Submit({
  label,
  pendingLabel,
  variant = "primary",
}: {
  label: string;
  pendingLabel: string;
  variant?: "primary" | "secondary" | "danger";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/* -------------------------------------------------------------------------- */
/* Identity: name, monogram, colour, copy                                     */
/* -------------------------------------------------------------------------- */

export function BrandingForm({
  action,
  initial,
  appUrlFallback,
}: {
  action: Action;
  initial: BrandingValues;
  appUrlFallback: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const [brandName, setBrandName] = useState(initial.brandName);
  const [monogram, setMonogram] = useState(initial.monogram);
  const [accent, setAccent] = useState(initial.accentColor);

  const fg = readableForeground(accent);

  return (
    <form action={formAction} className="space-y-6">
      {/* Live preview -------------------------------------------------- */}
      <div className="rounded-xl border border-ink-700 bg-ink-850 p-5">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-ink-400">
          Preview
        </p>
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex items-center gap-2 font-bold tracking-tight">
            {initial.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={initial.logoUrl}
                alt=""
                className="h-8 w-8 rounded-lg object-contain"
              />
            ) : (
              <span
                className="grid h-8 w-8 place-items-center rounded-lg text-sm font-black"
                style={{ backgroundColor: accent, color: fg }}
              >
                {monogram || "?"}
              </span>
            )}
            <span>{brandName || "Your brand"}</span>
          </div>
          <span
            className="rounded-lg px-4 py-2.5 text-sm font-semibold"
            style={{ backgroundColor: accent, color: fg }}
          >
            Start free trial
          </span>
          <span
            className="rounded-full border px-2.5 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: `${accent}26`,
              color: accent,
              borderColor: `${accent}4d`,
            }}
          >
            Most popular
          </span>
        </div>
        <p className="mt-4 text-xs text-ink-400">
          Text colour on the accent is chosen automatically from the colour&apos;s
          brightness, so a dark brand colour still reads.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Brand name"
          name="brandName"
          value={brandName}
          onChange={setBrandName}
          hint="Shown in headers, page titles and the footer."
        />
        <Field
          label="Monogram"
          name="monogram"
          value={monogram}
          onChange={setMonogram}
          maxLength={3}
          hint="1–3 characters, used when no logo image is set."
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink-300">
          Accent colour
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="color"
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded-lg border border-ink-700 bg-ink-850 p-1"
            aria-label="Pick an accent colour"
          />
          <input
            name="accentColor"
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            className="input w-32 font-mono"
            aria-label="Accent colour hex value"
          />
          <div className="flex flex-wrap gap-1.5">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setAccent(c)}
                aria-label={`Use ${c}`}
                className={`h-8 w-8 rounded-lg border-2 transition-transform hover:scale-105 ${
                  accent.toLowerCase() === c ? "border-ink-100" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </div>

      <Field
        label="Tagline"
        name="tagline"
        defaultValue={initial.tagline}
        hint="Appears after the brand name in the browser tab."
      />

      <div>
        <label
          htmlFor="metaDescription"
          className="mb-1.5 block text-sm font-medium text-ink-300"
        >
          Search & share description
        </label>
        <textarea
          id="metaDescription"
          name="metaDescription"
          rows={3}
          defaultValue={initial.metaDescription}
          className="input resize-y"
          required
        />
        <p className="mt-1.5 text-xs text-ink-400">
          Used for search results and link previews on social.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Public domain"
          name="canonicalUrl"
          defaultValue={initial.canonicalUrl}
          placeholder="train.example.com"
          hint={`Leave blank to use ${appUrlFallback}. Set this once DNS points at your deployment.`}
          required={false}
        />
        <Field
          label="Support email"
          name="supportEmail"
          type="email"
          defaultValue={initial.supportEmail}
          placeholder="help@example.com"
          hint="Shown in the footer. Optional."
          required={false}
        />
      </div>

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.notice ? <Alert tone="success">{state.notice}</Alert> : null}

      <Submit label="Save branding" pendingLabel="Saving…" />
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Logo upload                                                                */
/* -------------------------------------------------------------------------- */

export function LogoForm({
  uploadAction,
  removeAction,
  currentLogo,
}: {
  uploadAction: Action;
  removeAction: Action;
  currentLogo: string | null;
}) {
  const [uploadState, uploadFormAction] = useActionState(uploadAction, {});
  const [removeState, removeFormAction] = useActionState(removeAction, {});
  const [preview, setPreview] = useState<string | null>(null);

  const error = uploadState.error ?? removeState.error;
  const notice = uploadState.notice ?? removeState.notice;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl border border-ink-700 bg-ink-850">
          {preview ?? currentLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview ?? currentLogo ?? ""}
              alt="Current logo"
              className="h-12 w-12 object-contain"
            />
          ) : (
            <span className="text-xs text-ink-400">None</span>
          )}
        </div>
        <div className="text-xs text-ink-400">
          <p>PNG, JPEG, SVG or WebP. Up to 256KB.</p>
          <p className="mt-1">
            Square works best — it&apos;s rendered at 32px in headers.
          </p>
        </div>
      </div>

      <form action={uploadFormAction} className="space-y-3">
        <input
          type="file"
          name="logo"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return setPreview(null);
            const reader = new FileReader();
            reader.onload = () => setPreview(String(reader.result));
            reader.readAsDataURL(file);
          }}
          className="block w-full text-sm text-ink-300 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-ink-800 file:px-4 file:py-2 file:text-sm file:text-ink-100 hover:file:bg-ink-700"
          required
        />
        <Submit label="Upload logo" pendingLabel="Uploading…" variant="secondary" />
      </form>

      {currentLogo ? (
        <form action={removeFormAction}>
          <Submit label="Remove logo" pendingLabel="Removing…" variant="danger" />
        </form>
      ) : null}

      {error ? <Alert tone="danger">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}
    </div>
  );
}

export function ResetBrandingForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction}>
      <p className="mb-3 text-xs text-ink-400">
        Restores the default name, monogram, colour and copy. Your content,
        members and payments are untouched.
      </p>
      {state.error ? (
        <div className="mb-3">
          <Alert tone="danger">{state.error}</Alert>
        </div>
      ) : null}
      {state.notice ? (
        <div className="mb-3">
          <Alert tone="success">{state.notice}</Alert>
        </div>
      ) : null}
      <Submit label="Reset to defaults" pendingLabel="Resetting…" variant="danger" />
    </form>
  );
}

/* -------------------------------------------------------------------------- */

function Field({
  label,
  name,
  hint,
  value,
  onChange,
  defaultValue,
  placeholder,
  maxLength,
  type = "text",
  required = true,
}: {
  label: string;
  name: string;
  hint?: string;
  value?: string;
  onChange?: (v: string) => void;
  defaultValue?: string;
  placeholder?: string;
  maxLength?: number;
  type?: string;
  required?: boolean;
}) {
  const controlled = value !== undefined && onChange !== undefined;
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-ink-300">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        maxLength={maxLength}
        placeholder={placeholder}
        required={required}
        className="input"
        {...(controlled
          ? { value, onChange: (e) => onChange(e.target.value) }
          : { defaultValue })}
      />
      {hint ? <p className="mt-1.5 text-xs text-ink-400">{hint}</p> : null}
    </div>
  );
}

/**
 * Mirrors the server-side luminance check so the preview matches what the
 * saved theme will actually render.
 */
function readableForeground(hex: string): string {
  const clean = hex.replace(/^#/, "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  if (!/^[0-9a-f]{6}$/i.test(full)) return "#08090c";

  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel(parseInt(full.slice(0, 2), 16)) +
    0.7152 * channel(parseInt(full.slice(2, 4), 16)) +
    0.0722 * channel(parseInt(full.slice(4, 6), 16));

  return luminance > 0.45 ? "#08090c" : "#ffffff";
}
