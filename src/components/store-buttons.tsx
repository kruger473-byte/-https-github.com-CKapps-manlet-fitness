"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Alert, Button } from "./ui";
import type { StoreState } from "@/app/(app)/store/actions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Opening checkout…" : label}
    </Button>
  );
}

export function BuyButton({
  productId,
  label,
  action,
}: {
  productId: string;
  label: string;
  action: (prev: StoreState, formData: FormData) => Promise<StoreState>;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <div>
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
      <form action={formAction}>
        <input type="hidden" name="productId" value={productId} />
        <Submit label={label} />
      </form>
    </div>
  );
}
