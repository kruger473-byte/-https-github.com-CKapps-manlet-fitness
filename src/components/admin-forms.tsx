"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { Alert, Button } from "./ui";

/** Every admin action returns this shape, so the form shell isn't generic. */
export type AdminState = { error?: string; notice?: string };
export type FormAction = (prev: AdminState, formData: FormData) => Promise<AdminState>;

/* -------------------------------------------------------------------------- */
/* Field primitives                                                           */
/* -------------------------------------------------------------------------- */

export function TextField({
  label,
  name,
  defaultValue,
  placeholder,
  hint,
  type = "text",
  required = false,
  min,
  max,
  step,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  placeholder?: string;
  hint?: string;
  type?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-ink-300">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        required={required}
        min={min}
        max={max}
        step={step}
        className="input"
      />
      {hint ? <p className="mt-1.5 text-xs text-ink-400">{hint}</p> : null}
    </div>
  );
}

export function TextArea({
  label,
  name,
  defaultValue,
  placeholder,
  hint,
  rows = 4,
  required = false,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  hint?: string;
  rows?: number;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-ink-300">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={rows}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        required={required}
        className="input resize-y"
      />
      {hint ? <p className="mt-1.5 text-xs text-ink-400">{hint}</p> : null}
    </div>
  );
}

export function SelectField({
  label,
  name,
  options,
  defaultValue,
  hint,
}: {
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  defaultValue?: string | number | null;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-ink-300">
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={String(defaultValue ?? "")}
        className="input"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint ? <p className="mt-1.5 text-xs text-ink-400">{hint}</p> : null}
    </div>
  );
}

export function CheckboxField({
  label,
  name,
  defaultChecked,
  hint,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className="flex items-start gap-2.5 text-sm text-ink-300">
        <input
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          className="mt-0.5 h-4 w-4 rounded border-ink-600 bg-ink-850 accent-[var(--color-volt-500)]"
        />
        <span>
          {label}
          {hint ? <span className="block text-xs text-ink-400">{hint}</span> : null}
        </span>
      </label>
    </div>
  );
}

/** Tier picker, worded so it's obvious what each option means for a member. */
export function TierField({
  defaultValue,
  name = "minTier",
}: {
  defaultValue?: number;
  name?: string;
}) {
  return (
    <SelectField
      label="Who can see this?"
      name={name}
      defaultValue={defaultValue ?? 1}
      options={[
        { value: "0", label: "Everyone, including free accounts" },
        { value: "1", label: "Core members and above" },
        { value: "2", label: "Elite members only" },
      ]}
      hint="Anyone who buys this item individually gets access regardless."
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Form shell                                                                 */
/* -------------------------------------------------------------------------- */

export function SaveButton({
  label = "Save",
  pendingLabel = "Saving…",
  variant = "primary",
}: {
  label?: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/**
 * Wraps a server action with its own error/notice display.
 *
 * Every editor on the admin side uses this so feedback is consistent and no
 * form can silently do nothing.
 */
export function AdminForm({
  action,
  children,
  submitLabel = "Save",
  hiddenFields = {},
  className = "space-y-4",
}: {
  action: FormAction;
  children: ReactNode;
  submitLabel?: string;
  hiddenFields?: Record<string, string | undefined>;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className={className}>
      {Object.entries(hiddenFields).map(([key, value]) =>
        value === undefined ? null : (
          <input key={key} type="hidden" name={key} value={value} />
        ),
      )}
      {children}
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.notice ? <Alert tone="success">{state.notice}</Alert> : null}
      <SaveButton label={submitLabel} />
    </form>
  );
}

/** A destructive action behind a confirm dialog. */
export function DangerForm({
  action,
  hiddenFields,
  label,
  confirmMessage,
}: {
  action: (formData: FormData) => Promise<void>;
  hiddenFields: Record<string, string>;
  label: string;
  confirmMessage: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      {Object.entries(hiddenFields).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <SaveButton label={label} pendingLabel="Deleting…" variant="danger" />
    </form>
  );
}

/** Publish/unpublish toggle used in list views. */
export function PublishToggle({
  action,
  type,
  id,
  isPublished,
}: {
  action: (formData: FormData) => Promise<void>;
  type: string;
  id: string;
  isPublished: boolean;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
          isPublished
            ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
            : "border-ink-700 bg-ink-800 text-ink-400 hover:text-ink-100"
        }`}
        title={isPublished ? "Published — click to hide" : "Draft — click to publish"}
      >
        {isPublished ? "Live" : "Draft"}
      </button>
    </form>
  );
}
