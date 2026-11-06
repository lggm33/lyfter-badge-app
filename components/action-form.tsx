"use client";

import { startTransition, useActionState, type ReactNode } from "react";
import type { ActionState } from "@/app/lib/action-error";

/**
 * Submits through onSubmit instead of `<form action>`: React only auto-resets forms that use the
 * action prop, so a rejected submit keeps what the user typed and shows the error next to it.
 */
export function ActionForm({
  action,
  className,
  children,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  className?: string;
  children: ReactNode;
}) {
  const [state, dispatch, pending] = useActionState(action, null);

  return (
    <form
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => dispatch(formData));
      }}
    >
      {/* Disabled while pending so a double click cannot submit twice. */}
      <fieldset className="contents" disabled={pending}>
        {children}
      </fieldset>
      {state?.error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
