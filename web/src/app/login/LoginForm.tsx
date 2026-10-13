"use client";

import { useState } from "react";

type Step = "phone" | "code";

export function LoginForm({ returnTo }: { returnTo: string }) {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [needsName, setNeedsName] = useState(false);
  const [challengeId, setChallengeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/v1/auth/otp/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) return setError(body.errors?.phone?.[0] ?? body.title);
    setChallengeId(body.challenge_id);
    setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/v1/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challenge_id: challengeId, code, name: name || undefined, return_to: returnTo }),
    });
    const body = await res.json();
    if (res.ok) {
      window.location.assign(body.redirect_to);
      return;
    }
    setBusy(false);
    if (body.errors?.name) {
      setNeedsName(true);
      return setError(needsName ? body.errors.name[0] : null);
    }
    setError(body.title);
  }

  if (step === "phone") {
    return (
      <form onSubmit={sendCode} className="mt-6 space-y-4" noValidate>
        <div>
          <label htmlFor="phone" className="label">Mobile number</label>
          <div className="flex gap-2">
            <span className="input flex w-auto items-center bg-canvas text-muted" aria-hidden>+91</span>
            <input id="phone" className="input" inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210"
                   value={phone} onChange={(e) => setPhone(e.target.value)} required aria-invalid={!!error} aria-describedby={error ? "login-error" : undefined} />
          </div>
        </div>
        {error && <p id="login-error" role="alert" className="text-sm text-critical">{error}</p>}
        <button className="btn btn-primary w-full" disabled={busy || phone.replace(/\D/g, "").length < 10}>
          {busy ? "Sending…" : "Send code"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="mt-6 space-y-4" noValidate>
      <div>
        <label htmlFor="code" className="label">6-digit code sent to +91 {phone}</label>
        <input id="code" className="input text-center text-lg tracking-[0.5em]" inputMode="numeric" autoComplete="one-time-code"
               maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus required />
        <p className="mt-2 text-xs text-muted">Prototype: no SMS is sent. Use <strong>123456</strong>.</p>
      </div>
      {needsName && (
        <div>
          <label htmlFor="name" className="label">Your name</label>
          <input id="name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
          <p className="mt-2 text-xs text-muted">New here? Tell us your name to create your account.</p>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-critical">{error}</p>}
      <button className="btn btn-primary w-full" disabled={busy || code.length !== 6 || (needsName && !name.trim())}>
        {busy ? "Checking…" : needsName ? "Create account" : "Verify and continue"}
      </button>
      <button type="button" className="btn btn-ghost w-full" onClick={() => { setStep("phone"); setCode(""); setError(null); setNeedsName(false); }}>
        Use a different number
      </button>
    </form>
  );
}
