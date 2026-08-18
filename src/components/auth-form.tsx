"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Alert, Button } from "./ui";
import type { AuthFormState } from "@/app/(auth)/actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Working…" : label}
    </Button>
  );
}

export function AuthForm({
  mode,
  action,
  plan,
}: {
  mode: "login" | "signup";
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  plan?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const isSignup = mode === "signup";

  return (
    <div className="card p-7">
      <h1 className="text-xl font-bold">
        {isSignup ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mt-1.5 text-sm text-ink-400">
        {isSignup
          ? plan && plan !== "free"
            ? `You'll start a trial on the ${plan} plan after this step.`
            : "Free to start. No card required."
          : "Sign in to keep training."}
      </p>

      <form action={formAction} className="mt-6 space-y-4">
        {plan ? <input type="hidden" name="plan" value={plan} /> : null}

        {isSignup ? (
          <Field label="Name" name="name" type="text" autoComplete="name" placeholder="Sam Ortiz" />
        ) : null}
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          placeholder={isSignup ? "At least 8 characters" : "••••••••"}
        />

        {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

        <SubmitButton label={isSignup ? "Create account" : "Sign in"} />
      </form>

      <p className="mt-6 text-center text-sm text-ink-400">
        {isSignup ? (
          <>
            Already a member?{" "}
            <Link href="/login" className="font-medium text-volt-500 hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            No account yet?{" "}
            <Link href="/signup" className="font-medium text-volt-500 hover:underline">
              Start free
            </Link>
          </>
        )}
      </p>

      {!isSignup ? (
        <div className="mt-6 rounded-xl border border-ink-700 bg-ink-850 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">
            Demo accounts
          </p>
          <ul className="mt-2 space-y-1 text-xs text-ink-400">
            <li>
              <code className="text-ink-300">admin@manlet.fit</code> — creator console
            </li>
            <li>
              <code className="text-ink-300">coach@manlet.fit</code> — coach view
            </li>
            <li>
              <code className="text-ink-300">sam@example.com</code> — Elite member
            </li>
            <li>
              <code className="text-ink-300">free@manlet.fit</code> — free member
            </li>
          </ul>
          <p className="mt-2 text-xs text-ink-400">
            Password for all: <code className="text-ink-300">password123</code>
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  name,
  type,
  autoComplete,
  placeholder,
}: {
  label: string;
  name: string;
  type: string;
  autoComplete?: string;
  placeholder?: string;
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
        autoComplete={autoComplete}
        placeholder={placeholder}
        required
        className="input"
      />
    </div>
  );
}
