"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Alert, Button } from "./ui";
import type { BookingState } from "@/app/(app)/coaching/actions";

type Message = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
};

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Sending…" : "Send"}
    </Button>
  );
}

export function ClassroomChat({
  sessionId,
  messages,
  currentUserId,
  action,
}: {
  sessionId: string;
  messages: Message[];
  currentUserId: string;
  action: (prev: BookingState, formData: FormData) => Promise<BookingState>;
}) {
  const [state, formAction] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  return (
    <div className="card flex h-[32rem] flex-col p-0">
      <div className="border-b border-ink-800 px-5 py-3.5">
        <h2 className="text-sm font-semibold">Classroom chat</h2>
        <p className="text-xs text-ink-400">
          Stays here between calls — send videos links, questions, check-ins.
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-400">
            No messages yet. Say what you want to get out of the session.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.authorId === currentUserId;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    mine
                      ? "bg-volt-500 text-ink-950"
                      : "border border-ink-700 bg-ink-850 text-ink-100"
                  }`}
                >
                  {!mine ? (
                    <p className="mb-0.5 text-xs font-semibold opacity-70">
                      {m.authorName}
                    </p>
                  ) : null}
                  <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                  <p className={`mt-1 text-[10px] ${mine ? "opacity-60" : "text-ink-400"}`}>
                    {new Date(m.createdAt).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form ref={formRef} action={formAction} className="border-t border-ink-800 p-4">
        <input type="hidden" name="sessionId" value={sessionId} />
        {state.error ? (
          <div className="mb-3">
            <Alert tone="danger">{state.error}</Alert>
          </div>
        ) : null}
        <div className="flex gap-2">
          <input
            name="body"
            placeholder="Write a message…"
            className="input flex-1"
            autoComplete="off"
            required
          />
          <SendButton />
        </div>
      </form>
    </div>
  );
}

function SaveNotesButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? "Saving…" : "Save notes"}
    </Button>
  );
}

export function CoachNotes({
  sessionId,
  initialNotes,
  action,
}: {
  sessionId: string;
  initialNotes: string;
  action: (prev: BookingState, formData: FormData) => Promise<BookingState>;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="card p-5">
      <h2 className="text-sm font-semibold">Coach notes</h2>
      <p className="mt-1 text-xs text-ink-400">
        Visible to you and your client after the call.
      </p>
      <input type="hidden" name="sessionId" value={sessionId} />
      <textarea
        name="notes"
        defaultValue={initialNotes}
        rows={8}
        placeholder="What you observed, what changes for next block, what to send them."
        className="input mt-3 resize-y"
      />
      {state.error ? (
        <div className="mt-3">
          <Alert tone="danger">{state.error}</Alert>
        </div>
      ) : null}
      {state.ok ? (
        <div className="mt-3">
          <Alert tone="success">Notes saved.</Alert>
        </div>
      ) : null}
      <div className="mt-3">
        <SaveNotesButton />
      </div>
    </form>
  );
}
