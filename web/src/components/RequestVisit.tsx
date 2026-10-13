"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const WINDOWS = [
  { id: "morning", label: "Morning", from: "09:00", to: "12:00", hint: "9–12" },
  { id: "afternoon", label: "Afternoon", from: "12:00", to: "16:00", hint: "12–4" },
  { id: "evening", label: "Evening", from: "16:00", to: "20:00", hint: "4–8 pm" },
] as const;

interface Slot { date: string; window: (typeof WINDOWS)[number]["id"] }

const isoDay = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export function RequestVisitButton({ code, title, existingRequestId, sticky = false }: { code: string; title: string; existingRequestId: string | null; sticky?: boolean }) {
  const [open, setOpen] = useState(false);
  if (existingRequestId) {
    return <a href={`/requests/${existingRequestId}`} className={`btn btn-primary w-full ${sticky ? "" : ""}`}>View your request</a>;
  }
  return (
    <>
      <button type="button" className="btn btn-primary w-full" onClick={() => setOpen(true)} aria-haspopup="dialog">Request visit</button>
      {open && <RequestVisitSheet code={code} title={title} onClose={() => setOpen(false)} />}
    </>
  );
}

function RequestVisitSheet({ code, title, onClose }: { code: string; title: string; onClose: () => void }) {
  const router = useRouter();
  const days = useMemo(() => Array.from({ length: 10 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i + 1); return d; }), []);
  const [slots, setSlots] = useState<Slot[]>([{ date: isoDay(days[0]), window: "evening" }]);
  const [people, setPeople] = useState(1);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // One key per sheet: a double tap or retry never creates two requests.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  async function submit(type: "visit" | "interest") {
    setBusy(true);
    setError(null);
    const body = type === "visit"
      ? {
          property_code: code, type, people_count: people, note: note.trim() || undefined,
          preferred_slots: slots.map((s) => { const w = WINDOWS.find((x) => x.id === s.window)!; return { date: s.date, from: w.from, to: w.to }; }),
        }
      : { property_code: code, type, note: note.trim() || undefined };
    const res = await fetch("/api/v1/student/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": `${idempotencyKey}-${type}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setBusy(false);
      const fieldErrors = data.errors ? Object.values(data.errors).flat().join(" ") : "";
      return setError(fieldErrors || data.title);
    }
    router.push(`/requests/${data.request_id}?received=1`);
  }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="rv-title">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[92vh] flex-col rounded-t-2xl bg-white md:inset-auto md:left-1/2 md:top-1/2 md:w-[520px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 id="rv-title" className="text-lg font-bold">Request a visit</h2>
            <p className="text-sm text-muted">{title}</p>
          </div>
          <button type="button" className="btn btn-ghost -mr-2" onClick={onClose}>Close</button>
        </div>

        <div className="space-y-5 overflow-y-auto px-5 py-5">
          <fieldset>
            <legend className="label">When can you visit? Pick up to 3 options</legend>
            <div className="space-y-3">
              {slots.map((s, idx) => (
                <div key={idx} className="flex gap-2">
                  <select aria-label={`Option ${idx + 1} date`} className="input" value={s.date}
                          onChange={(e) => setSlots(slots.map((x, j) => (j === idx ? { ...x, date: e.target.value } : x)))}>
                    {days.map((d) => (
                      <option key={isoDay(d)} value={isoDay(d)}>{d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</option>
                    ))}
                  </select>
                  <select aria-label={`Option ${idx + 1} time`} className="input" value={s.window}
                          onChange={(e) => setSlots(slots.map((x, j) => (j === idx ? { ...x, window: e.target.value as Slot["window"] } : x)))}>
                    {WINDOWS.map((w) => <option key={w.id} value={w.id}>{w.label} · {w.hint}</option>)}
                  </select>
                  {slots.length > 1 && (
                    <button type="button" className="btn btn-ghost px-3" aria-label={`Remove option ${idx + 1}`} onClick={() => setSlots(slots.filter((_, j) => j !== idx))}>×</button>
                  )}
                </div>
              ))}
            </div>
            {slots.length < 3 && (
              <button type="button" className="btn btn-ghost mt-2 px-2" onClick={() => setSlots([...slots, { date: isoDay(days[Math.min(slots.length, days.length - 1)]), window: "evening" }])}>
                + Add another option
              </button>
            )}
          </fieldset>

          <div>
            <span className="label" id="people-label">How many people are coming?</span>
            <div className="flex items-center gap-3" role="group" aria-labelledby="people-label">
              <button type="button" className="btn btn-secondary w-11 px-0" aria-label="Fewer people" onClick={() => setPeople(Math.max(1, people - 1))} disabled={people <= 1}>−</button>
              <span className="w-8 text-center text-lg font-semibold" aria-live="polite">{people}</span>
              <button type="button" className="btn btn-secondary w-11 px-0" aria-label="More people" onClick={() => setPeople(Math.min(10, people + 1))} disabled={people >= 10}>+</button>
            </div>
          </div>

          <div>
            <label htmlFor="rv-note" className="label">Anything the broker should know? (optional)</label>
            <textarea id="rv-note" className="input min-h-24 py-2" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)}
                      placeholder="e.g. Looking for a bed from December, prefer a window bed" />
          </div>

          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-critical">{error}</p>}
        </div>

        <div className="space-y-2 border-t border-line p-4">
          <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={() => submit("visit")}>
            {busy ? "Sending…" : "Send visit request"}
          </button>
          <button type="button" className="btn btn-ghost w-full text-sm" disabled={busy} onClick={() => submit("interest")}>
            Not ready to visit? Just ask a broker to contact me
          </button>
        </div>
      </div>
    </div>
  );
}
