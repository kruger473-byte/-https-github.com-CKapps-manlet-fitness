"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Alert, Button } from "./ui";
import type { BookingState } from "@/app/(app)/coaching/actions";

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? "Booking…" : "Book this slot"}
    </Button>
  );
}

export function BookingForm({
  action,
  slots,
  canBook,
}: {
  action: (prev: BookingState, formData: FormData) => Promise<BookingState>;
  slots: Array<{ id: string; label: string }>;
  canBook: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <form action={formAction}>
      <p className="mb-3 text-sm font-medium">Open slots</p>
      <div className="flex flex-wrap gap-2">
        {slots.map((slot) => (
          <label
            key={slot.id}
            className={`cursor-pointer rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors ${
              selected === slot.id
                ? "border-volt-500 bg-volt-500 text-[var(--color-accent-fg)]"
                : "border-ink-700 bg-ink-850 text-ink-300 hover:border-ink-600"
            }`}
          >
            <input
              type="radio"
              name="slotId"
              value={slot.id}
              checked={selected === slot.id}
              onChange={() => setSelected(slot.id)}
              className="sr-only"
            />
            {slot.label}
          </label>
        ))}
      </div>

      {selected ? (
        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="agenda" className="mb-1.5 block text-xs font-medium text-ink-300">
              What do you want to cover?
            </label>
            <input
              id="agenda"
              name="agenda"
              type="text"
              placeholder="e.g. squat depth and load selection for week 5"
              className="input"
            />
          </div>
          <div>
            <label htmlFor="goals" className="mb-1.5 block text-xs font-medium text-ink-300">
              Your goal right now
            </label>
            <input
              id="goals"
              name="goals"
              type="text"
              placeholder="e.g. add 10kg to my squat without the knee flaring up"
              className="input"
            />
          </div>
        </div>
      ) : null}

      {state.error ? (
        <div className="mt-4">
          <Alert tone="danger">{state.error}</Alert>
        </div>
      ) : null}

      {!canBook ? (
        <p className="mt-4 text-xs text-ink-400">
          You have no credits left.{" "}
          <Link href="/account/billing" className="font-medium text-volt-500 hover:underline">
            Upgrade to Elite
          </Link>{" "}
          for 2 sessions a month.
        </p>
      ) : null}

      <div className="mt-4">
        <SubmitButton disabled={!selected || !canBook} />
      </div>
    </form>
  );
}
