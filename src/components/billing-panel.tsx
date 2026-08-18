"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Alert, Badge, Button, CheckIcon } from "./ui";
import type { BillingState } from "@/app/(app)/account/billing/actions";

export type PlanView = {
  id: string;
  key: string;
  name: string;
  tagline: string;
  tier: number;
  monthly: string;
  yearly: string;
  monthlyCents: number;
  trialDays: number;
  features: string[];
};

function ActionButton({
  label,
  pendingLabel,
  variant = "primary",
  disabled,
  className = "",
}: {
  label: string;
  pendingLabel: string;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending || disabled} className={className}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function PlanPicker({
  plans,
  currentTier,
  action,
  stripeReady,
}: {
  plans: PlanView[];
  currentTier: number;
  action: (prev: BillingState, formData: FormData) => Promise<BillingState>;
  stripeReady: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const [interval, setInterval] = useState<"month" | "year">("month");

  return (
    <div>
      <div className="mb-5 flex items-center justify-center">
        <div className="flex gap-1 rounded-lg border border-ink-700 bg-ink-850 p-1">
          {(["month", "year"] as const).map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setInterval(i)}
              className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
                interval === i ? "bg-volt-500 text-ink-950" : "text-ink-400 hover:text-ink-100"
              }`}
            >
              {i === "month" ? "Monthly" : "Yearly — save ~2 months"}
            </button>
          ))}
        </div>
      </div>

      {state.error ? (
        <div className="mb-4">
          <Alert tone="danger">{state.error}</Alert>
        </div>
      ) : null}
      {state.notice ? (
        <div className="mb-4">
          <Alert tone="success">{state.notice}</Alert>
        </div>
      ) : null}

      {!stripeReady ? (
        <div className="mb-4">
          <Alert tone="warning">
            Stripe is not configured, so checkout runs in demo mode — plans activate
            locally and record the same payment and conversion rows a real sale would.
            Set <code>STRIPE_SECRET_KEY</code> and <code>STRIPE_WEBHOOK_SECRET</code> to
            take live payments.
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.tier === currentTier;
          const isDowngrade = plan.tier < currentTier;
          return (
            <div
              key={plan.id}
              className={`card flex flex-col p-5 ${
                isCurrent ? "border-volt-500/50 ring-1 ring-volt-500/20" : ""
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-base font-bold">{plan.name}</h3>
                {isCurrent ? <Badge tone="volt">Current</Badge> : null}
              </div>
              <p className="text-xs text-ink-400">{plan.tagline}</p>

              <p className="mt-4">
                <span className="text-3xl font-black tabular-nums">
                  {plan.monthlyCents === 0
                    ? "Free"
                    : interval === "month"
                      ? plan.monthly
                      : plan.yearly}
                </span>
                {plan.monthlyCents > 0 ? (
                  <span className="text-xs text-ink-400">
                    /{interval === "month" ? "month" : "year"}
                  </span>
                ) : null}
              </p>

              <ul className="mt-5 flex-1 space-y-2 text-xs text-ink-300">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-volt-500" />
                    {f}
                  </li>
                ))}
              </ul>

              {plan.monthlyCents > 0 && !isCurrent ? (
                <form action={formAction} className="mt-5">
                  <input type="hidden" name="planKey" value={plan.key} />
                  <input type="hidden" name="interval" value={interval} />
                  <ActionButton
                    label={isDowngrade ? `Switch to ${plan.name}` : `Start ${plan.trialDays}-day trial`}
                    pendingLabel="Opening checkout…"
                    variant={isDowngrade ? "secondary" : "primary"}
                    className="w-full"
                  />
                </form>
              ) : (
                <div className="mt-5 h-[42px]" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ManageSubscription({
  subscriptionId,
  cancelAtPeriodEnd,
  portalAction,
  cancelAction,
  resumeAction,
  stripeReady,
}: {
  subscriptionId: string;
  cancelAtPeriodEnd: boolean;
  portalAction: (prev: BillingState, formData: FormData) => Promise<BillingState>;
  cancelAction: (prev: BillingState, formData: FormData) => Promise<BillingState>;
  resumeAction: (prev: BillingState, formData: FormData) => Promise<BillingState>;
  stripeReady: boolean;
}) {
  const [portalState, portalFormAction] = useActionState(portalAction, {});
  const [cancelState, cancelFormAction] = useActionState(cancelAction, {});
  const [resumeState, resumeFormAction] = useActionState(resumeAction, {});

  const message =
    portalState.error ?? cancelState.error ?? resumeState.error ?? null;
  const notice = cancelState.notice ?? resumeState.notice ?? null;

  return (
    <div>
      {message ? (
        <div className="mb-4">
          <Alert tone="danger">{message}</Alert>
        </div>
      ) : null}
      {notice ? (
        <div className="mb-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {stripeReady ? (
          <form action={portalFormAction}>
            <ActionButton
              label="Manage payment method"
              pendingLabel="Opening…"
              variant="secondary"
            />
          </form>
        ) : null}

        {cancelAtPeriodEnd ? (
          <form action={resumeFormAction}>
            <input type="hidden" name="subscriptionId" value={subscriptionId} />
            <ActionButton label="Resume subscription" pendingLabel="Resuming…" />
          </form>
        ) : (
          <form action={cancelFormAction}>
            <input type="hidden" name="subscriptionId" value={subscriptionId} />
            <ActionButton
              label="Cancel at period end"
              pendingLabel="Cancelling…"
              variant="danger"
            />
          </form>
        )}
      </div>
    </div>
  );
}
