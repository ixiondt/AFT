"use client";

import { useState } from "react";
import { SubmitButton } from "../../../submit-button";

/** Two-step delete: a plain button that arms an inline confirm (no blocking dialog). */
export function DeleteUnitButton({
  action,
  unitId,
}: {
  action: (formData: FormData) => Promise<void>;
  unitId: string;
}) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="text-xs text-[var(--color-danger)] hover:underline"
      >
        Delete unit…
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="unitId" value={unitId} />
      <span className="text-xs text-[var(--color-ink-2)]">
        Delete this unit, its roster, and any AT plan? This can’t be undone.
      </span>
      <SubmitButton
        pendingLabel="Deleting…"
        className="text-xs font-medium text-[var(--color-danger)] hover:underline"
      >
        Yes, delete
      </SubmitButton>
      <button
        type="button"
        onClick={() => setArmed(false)}
        className="text-xs text-[var(--color-ink-3)] hover:underline"
      >
        Cancel
      </button>
    </form>
  );
}
