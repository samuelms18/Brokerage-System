"use client";

import { useState } from "react";

/** Saves privately. Never creates a lead or contacts a broker (D-16). */
export function ShortlistButton({ code, initial, variant = "icon" }: { code: string; initial: boolean; variant?: "icon" | "button" }) {
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    const next = !saved;
    setSaved(next);
    const res = await fetch(`/api/v1/student/shortlist/${encodeURIComponent(code)}`, { method: next ? "PUT" : "DELETE" });
    if (!res.ok) setSaved(!next);
    setBusy(false);
  }

  const heart = (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5">
      <path fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round"
            d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
    </svg>
  );

  if (variant === "button") {
    return (
      <button type="button" className="btn btn-secondary w-full" onClick={toggle} disabled={busy} aria-pressed={saved}>
        <span className={saved ? "text-critical" : ""}>{heart}</span>
        {saved ? "Saved to shortlist" : "Shortlist"}
      </button>
    );
  }
  return (
    <button type="button" onClick={toggle} disabled={busy} aria-pressed={saved}
            aria-label={saved ? "Remove from shortlist" : "Save to shortlist"}
            className={`grid h-11 w-11 place-items-center rounded-full bg-white/95 shadow-sm ${saved ? "text-critical" : "text-ink"}`}>
      {heart}
    </button>
  );
}
