"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Alert, Button } from "./ui";
import type { ExchangeState } from "@/app/(app)/exchange/actions";

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function NewThreadForm({
  action,
  categories,
}: {
  action: (prev: ExchangeState, formData: FormData) => Promise<ExchangeState>;
  categories: Array<{ id: string; name: string }>;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="card space-y-4 p-6">
      <div>
        <label htmlFor="title" className="mb-1.5 block text-sm font-medium text-ink-300">
          Title
        </label>
        <input
          id="title"
          name="title"
          placeholder="Knee pain on the squat — anyone else?"
          className="input"
          required
        />
      </div>

      <div>
        <label htmlFor="categoryId" className="mb-1.5 block text-sm font-medium text-ink-300">
          Category
        </label>
        <select id="categoryId" name="categoryId" className="input">
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="body" className="mb-1.5 block text-sm font-medium text-ink-300">
          What&apos;s going on?
        </label>
        <textarea
          id="body"
          name="body"
          rows={8}
          placeholder="Include the specifics — what you're running, what you've tried, and the actual numbers. Vague questions get vague answers."
          className="input resize-y"
          required
        />
      </div>

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <Submit label="Post thread" pendingLabel="Posting…" />
    </form>
  );
}

export function ReplyForm({
  threadId,
  action,
  canReply,
}: {
  threadId: string;
  action: (prev: ExchangeState, formData: FormData) => Promise<ExchangeState>;
  canReply: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state.ok]);

  if (!canReply) {
    return (
      <div className="card p-5">
        <p className="text-sm text-ink-400">
          Replying is included with Core and Elite membership.
        </p>
      </div>
    );
  }

  return (
    <form ref={ref} action={formAction} className="card space-y-3 p-5">
      <input type="hidden" name="threadId" value={threadId} />
      <label htmlFor="reply-body" className="block text-sm font-medium text-ink-300">
        Your reply
      </label>
      <textarea
        id="reply-body"
        name="body"
        rows={4}
        placeholder="Add something useful…"
        className="input resize-y"
        required
      />
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <Submit label="Reply" pendingLabel="Posting…" />
    </form>
  );
}
