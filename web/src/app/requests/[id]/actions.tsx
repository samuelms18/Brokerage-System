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

export function ConfirmVisitButton({ visitId }: { visitId: string }) {
  const { busy, error, run } = useAction();
  return (
    <>
      <button type="button" className="btn btn-primary mt-2" disabled={busy} onClick={() => run(`/api/v1/student/visits/${visitId}/confirm`)}>
        Confirm this time
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-critical">{error}</p>}
    </>
  );
}
