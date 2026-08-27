"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * The two-step delete used on admin list rows. The first press arms the
 * button; anything else disarms it. The server action passed in owns
 * authorization and cleanup.
 */
export function RowDeleteButton({
  label,
  confirmLabel,
  pendingLabel,
  action,
}: {
  label: string;
  confirmLabel: string;
  pendingLabel: string;
  action: () => Promise<{ status: string }>;
}) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!armed) {
      setArmed(true);
      return;
    }
    setPending(true);
    const result = await action();
    setPending(false);
    setArmed(false);
    if (result.status === "success") router.refresh();
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => void handleClick()}
      onBlur={() => setArmed(false)}
      className={`inline-flex min-h-10 shrink-0 items-center rounded-full border px-4 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-45 ${
        armed
          ? "border-lacquer bg-lacquer text-ivory"
          : "border-lacquer/30 text-lacquer hover:border-lacquer/60"
      }`}
    >
      {pending ? pendingLabel : armed ? confirmLabel : label}
    </button>
  );
}
