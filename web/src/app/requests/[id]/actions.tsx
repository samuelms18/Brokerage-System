"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(url: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(url, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return setError(body.title ?? "Something went wrong");
    }
    router.refresh();
  }
  return { busy, error, run };
}

export function AcknowledgeButton({ requestId }: { requestId: string }) {
  const { busy, error, run } = useAction();
  return (
    <>
      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => run(`/api/v1/student/requests/${requestId}/brokerage/acknowledge`)}>
        I&apos;ve seen this amount
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-critical">{error}</p>}
    </>
  );
}

export function CancelRequestButton({ requestId }: { requestId: string }) {
  const { busy, error, run } = useAction();
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return <button type="button" className="btn btn-ghost text-critical" onClick={() => setConfirming(true)}>Withdraw this request</button>;
  }
  return (
    <div className="card flex flex-wrap items-center gap-3 p-4">
      <p className="flex-1 text-sm">Withdraw this request? The broker will stop working on it.</p>
      <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)}>Keep it</button>
      <button type="button" className="btn btn-primary bg-critical hover:bg-red-800" disabled={busy} onClick={() => run(`/api/v1/student/requests/${requestId}/cancel`)}>Withdraw</button>
      {error && <p role="alert" className="w-full text-sm text-critical">{error}</p>}
    </div>
  );
}

/** PROTOTYPE ONLY: stands in for the broker app until it is built. */
export function PrototypeControls({ requestId, accepted, hasBrokerage }: { requestId: string; accepted: boolean; hasBrokerage: boolean }) {
  const { busy, error, run } = useAction();
  return (
    <aside className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/60 p-4" aria-label="Prototype controls">
      <p className="text-sm font-semibold text-attention">Prototype controls</p>
      <p className="mt-1 text-xs text-muted">Simulate what a broker does in the broker app (not built yet). Students never see this panel.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary" disabled={busy || accepted} onClick={() => run(`/api/prototype/requests/${requestId}/accept`)}>
          {accepted ? "Broker has accepted ✓" : "Simulate: broker accepts"}
        </button>
        <button type="button" className="btn btn-secondary" disabled={busy || !accepted || hasBrokerage} onClick={() => run(`/api/prototype/requests/${requestId}/disclose-brokerage`)}>
          {hasBrokerage ? "Brokerage shared ✓" : "Simulate: broker shares brokerage"}
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-critical">{error}</p>}
    </aside>
  );
}
