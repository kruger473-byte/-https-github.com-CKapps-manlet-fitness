"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Alert, Button, Badge } from "./ui";
import type { PricingState } from "@/app/(app)/admin/pricing/actions";

export type ContentOption = {
  ref: string; // "TYPE:id"
  type: string;
  label: string;
};

type Action = (prev: PricingState, formData: FormData) => Promise<PricingState>;

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

const TYPE_LABELS: Record<string, string> = {
  PROGRAM: "A training program",
  DIET_PLAN: "A diet plan",
  SUPPLEMENT_PLAN: "A supplement plan",
  ARTICLE: "A knowledge base article",
  BUNDLE: "A bundle of several items",
};

/**
 * Product editor.
 *
 * The item picker switches between single-select and multi-select as the
 * product type changes, so a bundle and a single product use one form without
 * the operator having to think about which fields apply.
 */
export function ProductForm({
  action,
  options,
  initial,
  submitLabel = "Create product",
}: {
  action: Action;
  options: ContentOption[];
  initial?: {
    id: string;
    name: string;
    description: string;
    price: string;
    currency: string;
    stripePriceId: string | null;
    contentType: string;
    selectedRefs: string[];
    isActive: boolean;
    sortOrder: number;
  };
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const [contentType, setContentType] = useState(initial?.contentType ?? "PROGRAM");
  const [selected, setSelected] = useState<string[]>(initial?.selectedRefs ?? []);

  const isBundle = contentType === "BUNDLE";
  const relevant = isBundle
    ? options
    : options.filter((o) => o.type === contentType);

  function toggle(ref: string) {
    if (isBundle) {
      setSelected((prev) =>
        prev.includes(ref) ? prev.filter((r) => r !== ref) : [...prev, ref],
      );
    } else {
      setSelected([ref]);
    }
  }

  return (
    <form action={formAction} className="space-y-4">
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      {selected.map((ref) => (
        <input key={ref} type="hidden" name="contentRef" value={ref} />
      ))}

      <div>
        <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-ink-300">
          Product name
        </label>
        <input
          id="name"
          name="name"
          defaultValue={initial?.name}
          placeholder="Elite Peaking Block"
          className="input"
          required
        />
      </div>

      <div>
        <label
          htmlFor="description"
          className="mb-1.5 block text-sm font-medium text-ink-300"
        >
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          defaultValue={initial?.description}
          placeholder="What they get, and that it's theirs permanently."
          className="input resize-y"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="price" className="mb-1.5 block text-sm font-medium text-ink-300">
            Price
          </label>
          <input
            id="price"
            name="price"
            type="number"
            step="0.01"
            min="0.5"
            defaultValue={initial?.price ?? "49.00"}
            className="input"
            required
          />
          <p className="mt-1.5 text-xs text-ink-400">One-time, not recurring.</p>
        </div>
        <div>
          <label htmlFor="currency" className="mb-1.5 block text-sm font-medium text-ink-300">
            Currency
          </label>
          <input
            id="currency"
            name="currency"
            defaultValue={initial?.currency ?? "usd"}
            className="input"
          />
        </div>
        <div>
          <label htmlFor="sortOrder" className="mb-1.5 block text-sm font-medium text-ink-300">
            Sort order
          </label>
          <input
            id="sortOrder"
            name="sortOrder"
            type="number"
            defaultValue={initial?.sortOrder ?? 0}
            className="input"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="contentType"
          className="mb-1.5 block text-sm font-medium text-ink-300"
        >
          What does buying this unlock?
        </label>
        <select
          id="contentType"
          name="contentType"
          value={contentType}
          onChange={(e) => {
            setContentType(e.target.value);
            setSelected([]);
          }}
          className="input"
        >
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-ink-300">
          {isBundle ? "Pick every item in the bundle" : "Pick the item"}
          {selected.length > 0 ? (
            <span className="ml-2 text-xs font-normal text-volt-500">
              {selected.length} selected
            </span>
          ) : null}
        </p>

        {relevant.length === 0 ? (
          <Alert tone="warning">
            Nothing of that type exists yet. Create it under Content first.
          </Alert>
        ) : (
          <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-xl border border-ink-700 bg-ink-850 p-3">
            {relevant.map((option) => {
              const active = selected.includes(option.ref);
              return (
                <button
                  key={option.ref}
                  type="button"
                  onClick={() => toggle(option.ref)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    active
                      ? "bg-volt-500/15 text-volt-500"
                      : "text-ink-300 hover:bg-ink-800"
                  }`}
                >
                  <span className="min-w-0 truncate">{option.label}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    {isBundle ? (
                      <Badge>{option.type.replace("_", " ").toLowerCase()}</Badge>
                    ) : null}
                    <span className="text-xs">{active ? "✓" : ""}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <label
          htmlFor="stripePriceId"
          className="mb-1.5 block text-sm font-medium text-ink-300"
        >
          Stripe price ID (optional)
        </label>
        <input
          id="stripePriceId"
          name="stripePriceId"
          defaultValue={initial?.stripePriceId ?? ""}
          placeholder="price_…"
          className="input"
        />
        <p className="mt-1.5 text-xs text-ink-400">
          Leave blank and the price above is sent to Stripe directly, so the product
          is sellable straight away.
        </p>
      </div>

      <label className="flex items-start gap-2.5 text-sm text-ink-300">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={initial?.isActive ?? true}
          className="mt-0.5 h-4 w-4 rounded border-ink-600 bg-ink-850 accent-[var(--color-volt-500)]"
        />
        <span>
          On sale
          <span className="block text-xs text-ink-400">
            Uncheck to hide it without deleting it.
          </span>
        </span>
      </label>

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.notice ? <Alert tone="success">{state.notice}</Alert> : null}

      <Submit label={submitLabel} />
    </form>
  );
}

/** Give a member access without taking payment. */
export function ManualGrantForm({
  action,
  options,
}: {
  action: Action;
  options: ContentOption[];
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="grant-email" className="mb-1.5 block text-sm font-medium text-ink-300">
          Member email
        </label>
        <input
          id="grant-email"
          name="email"
          type="email"
          placeholder="member@example.com"
          className="input"
          required
        />
      </div>
      <div>
        <label htmlFor="grant-ref" className="mb-1.5 block text-sm font-medium text-ink-300">
          Give them
        </label>
        <select id="grant-ref" name="contentRef" className="input" required>
          {options.map((o) => (
            <option key={o.ref} value={o.ref}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="grant-note" className="mb-1.5 block text-sm font-medium text-ink-300">
          Note
        </label>
        <input
          id="grant-note"
          name="note"
          placeholder="Refund replacement, competition prize…"
          className="input"
        />
      </div>

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.notice ? <Alert tone="success">{state.notice}</Alert> : null}

      <Submit label="Grant access" />
    </form>
  );
}
