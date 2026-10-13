"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorText, toIso, tomorrowAt, usePost } from "./usePost";

const LEAD_STATUS_OPTIONS = [
  ["contacted", "Contacted"], ["requirement_confirmed", "Requirement confirmed"], ["properties_suggested", "Properties suggested"],
  ["interested", "Interested"], ["negotiation", "Negotiation"],
] as const;
const CLOSE_OPTIONS = [["not_interested", "Not interested"], ["lost", "Lost"], ["duplicate", "Duplicate"]] as const;

export function AvailabilityToggle({ accepting }: { accepting: boolean }) {
  const { busy, error, send } = usePost();
  return (
    <div>
      <label className="flex cursor-pointer items-center gap-3">
        <span className="relative inline-flex">
          <input type="checkbox" role="switch" className="peer sr-only" checked={accepting} disabled={busy}
                 onChange={(e) => send("/api/v1/broker/availability", { accepting_leads: e.target.checked }, "PUT")} />
          <span className="h-7 w-12 rounded-full bg-gray-300 transition peer-checked:bg-brand-600 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500" />
          <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
        </span>
        <span className="text-sm font-semibold">{accepting ? "Receiving new leads" : "Not receiving new leads"}</span>
      </label>
      {!accepting && <p className="mt-1 text-xs text-muted">Offered leads you haven&apos;t accepted were moved to other brokers. Accepted leads stay with you.</p>}
      <ErrorText error={error} />
    </div>
  );
}

export function AcceptDecline({ leadId }: { leadId: string }) {
  const router = useRouter();
  const { busy, error, send } = usePost();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <div>
      {!declining ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => send(`/api/v1/broker/leads/${leadId}/accept`)}>Accept lead</button>
          <button type="button" className="btn btn-secondary" onClick={() => setDeclining(true)}>Decline</button>
        </div>
      ) : (
        <form className="space-y-2" onSubmit={async (e) => {
          e.preventDefault();
          if (await send(`/api/v1/broker/leads/${leadId}/decline`, { reason })) router.push("/broker/leads");
        }}>
          <label htmlFor="decline-reason" className="label">Why are you declining? (goes to another broker automatically)</label>
          <input id="decline-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Fully booked with visits this week" />
          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={busy || !reason.trim()}>Decline lead</button>
            <button type="button" className="btn btn-ghost" onClick={() => setDeclining(false)}>Back</button>
          </div>
        </form>
      )}
      <ErrorText error={error} />
    </div>
  );
}

export function StatusForm({ leadId }: { leadId: string }) {
  const { busy, error, send } = usePost();
  const [to, setTo] = useState<string>("contacted");
  const [action, setAction] = useState("");
  const [due, setDue] = useState(tomorrowAt());
  const [reason, setReason] = useState("");
  const closing = CLOSE_OPTIONS.some(([v]) => v === to);
  return (
    <form className="space-y-3" onSubmit={(e) => {
      e.preventDefault();
      send(`/api/v1/broker/leads/${leadId}/status`, closing
        ? { to_status: to, reason }
        : { to_status: to, next_action: { action, due_at: toIso(due) } });
    }}>
      <div>
        <label htmlFor="to-status" className="label">Move lead to</label>
        <select id="to-status" className="input" value={to} onChange={(e) => setTo(e.target.value)}>
          <optgroup label="In progress">{LEAD_STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</optgroup>
          <optgroup label="Close lead">{CLOSE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</optgroup>
        </select>
      </div>
      {closing ? (
        <div>
          <label htmlFor="close-reason" className="label">Reason (required)</label>
          <input id="close-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
          <div>
            <label htmlFor="next-action" className="label">Next action (required)</label>
            <input id="next-action" className="input" value={action} onChange={(e) => setAction(e.target.value)} placeholder="e.g. Send two more options in budget" />
          </div>
          <div>
            <label htmlFor="next-due" className="label">Due</label>
            <input id="next-due" type="datetime-local" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
        </div>
      )}
      <button className="btn btn-secondary" disabled={busy || (closing ? !reason.trim() : !action.trim())}>Update lead</button>
      <ErrorText error={error} />
    </form>
  );
}

export function VisitPropose({ visitId, leadId, label = "Propose time" }: { visitId?: string; leadId?: string; label?: string }) {
  const { busy, error, send } = usePost();
  const [at, setAt] = useState(tomorrowAt(17));
  const url = visitId ? `/api/v1/broker/visits/${visitId}/propose` : `/api/v1/broker/leads/${leadId}/visits`;
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); send(url, { scheduled_at: toIso(at) }); }}>
      <div>
        <label htmlFor={`visit-at-${visitId ?? leadId}`} className="label">Visit time</label>
        <input id={`visit-at-${visitId ?? leadId}`} type="datetime-local" className="input" value={at} onChange={(e) => setAt(e.target.value)} />
      </div>
      <button className="btn btn-secondary" disabled={busy}>{label}</button>
      <div className="w-full"><ErrorText error={error} /></div>
    </form>
  );
}

export function VisitOutcome({ visitId }: { visitId: string }) {
  const { busy, error, send } = usePost();
  const [outcome, setOutcome] = useState("interested");
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label htmlFor={`outcome-${visitId}`} className="label">How did the visit go?</label>
        <select id={`outcome-${visitId}`} className="input" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
          <option value="interested">Interested</option>
          <option value="negotiating">Negotiating</option>
          <option value="wants_more_options">Wants more options</option>
          <option value="not_interested">Not interested</option>
        </select>
      </div>
      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => send(`/api/v1/broker/visits/${visitId}/outcome`, { status: "completed", outcome })}>Mark visited</button>
      <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => send(`/api/v1/broker/visits/${visitId}/outcome`, { status: "no_show" })}>No-show</button>
      <div className="w-full"><ErrorText error={error} /></div>
    </div>
  );
}

export interface BedOption { id: string; label: string; status: string; note: string }

export function StartAssignment({ leadId, beds }: { leadId: string; beds: BedOption[] }) {
  const router = useRouter();
  const { busy, error, send } = usePost();
  const free = beds.filter((b) => b.status === "available");
  const [bedId, setBedId] = useState(free[0]?.id ?? "");
  const [moveIn, setMoveIn] = useState("");
  if (free.length === 0) return <p className="text-sm text-muted">No beds are available at this property.</p>;
  return (
    <form className="space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      const res = (await send("/api/v1/broker/assignments", { lead_id: leadId, bed_id: bedId, move_in_date: moveIn || undefined })) as { id?: string } | null;
      if (res?.id) router.push(`/broker/assignments/${res.id}`);
    }}>
      <fieldset>
        <legend className="label">Choose a bed</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {beds.map((b) => (
            <label key={b.id} className={`card flex cursor-pointer items-center gap-3 p-3 ${b.status !== "available" ? "cursor-not-allowed opacity-50" : ""} ${bedId === b.id ? "border-brand-500 ring-2 ring-brand-100" : ""}`}>
              <input type="radio" name="bed" value={b.id} checked={bedId === b.id} disabled={b.status !== "available"} onChange={() => setBedId(b.id)} />
              <span className="text-sm"><span className="font-semibold">{b.label}</span><span className="block text-muted">{b.note}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="max-w-xs">
        <label htmlFor="move-in" className="label">Move-in date (optional)</label>
        <input id="move-in" type="date" className="input" value={moveIn} onChange={(e) => setMoveIn(e.target.value)} />
      </div>
      <button className="btn btn-primary" disabled={busy || !bedId}>Reserve bed and start assignment</button>
      <ErrorText error={error} />
    </form>
  );
}

export function DiscloseButtons({ assignmentId, party }: { assignmentId: string; party: "student" | "owner" }) {
  const { busy, error, send } = usePost();
  const [method, setMethod] = useState(party === "student" ? "in_app" : "whatsapp");
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label={`How the ${party} was told`} className="input h-10 min-h-0 w-auto text-sm" value={method} onChange={(e) => setMethod(e.target.value)}>
          {party === "student" && <option value="in_app">In the app (sends to student)</option>}
          <option value="whatsapp">WhatsApp</option>
          <option value="phone">Phone call</option>
          <option value="in_person">In person</option>
          <option value="email">Email</option>
        </select>
        <button type="button" className="btn btn-secondary h-10 min-h-0" disabled={busy}
                onClick={() => send(`/api/v1/broker/assignments/${assignmentId}/brokerage-disclosures`, { party, method })}>
          {party === "student" ? "Show to student" : "Record shown to owner"}
        </button>
      </div>
      <ErrorText error={error} />
    </div>
  );
}

export function OverrideForm({ assignmentId }: { assignmentId: string }) {
  const { busy, error, send } = usePost();
  const [open, setOpen] = useState(false);
  const [party, setParty] = useState("student");
  const [calc, setCalc] = useState("flat");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  if (!open) return <button type="button" className="btn btn-ghost px-2" onClick={() => setOpen(true)}>Override for this assignment…</button>;
  return (
    <form className="card space-y-3 bg-canvas p-4" onSubmit={async (e) => {
      e.preventDefault();
      if (await send(`/api/v1/broker/assignments/${assignmentId}/brokerage-overrides`, { party, calc_type: calc, value: calc === "not_charged" ? undefined : value, reason })) setOpen(false);
    }}>
      <p className="text-sm font-semibold">Assignment-level override</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className="label" htmlFor="ov-party">Party</label>
          <select id="ov-party" className="input" value={party} onChange={(e) => setParty(e.target.value)}><option value="student">Student</option><option value="owner">Owner</option></select></div>
        <div><label className="label" htmlFor="ov-calc">Calculation</label>
          <select id="ov-calc" className="input" value={calc} onChange={(e) => setCalc(e.target.value)}>
            <option value="flat">Fixed amount (₹)</option><option value="percent_of_monthly_rent">% of monthly rent</option>
            <option value="months_of_rent">Months of rent</option><option value="not_charged">Not charged</option>
          </select></div>
        {calc !== "not_charged" && <div><label className="label" htmlFor="ov-value">Value</label>
          <input id="ov-value" className="input" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} /></div>}
      </div>
      <div><label className="label" htmlFor="ov-reason">Reason (required, kept in history)</label>
        <input id="ov-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Negotiated early-bird discount" /></div>
      <p className="text-xs text-muted">Changing an amount means it must be shown to that party again before confirming.</p>
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={busy || reason.trim().length < 3}>Save override</button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      <ErrorText error={error} />
    </form>
  );
}

export function ConfirmAssignment({ assignmentId, ready, missing }: { assignmentId: string; ready: boolean; missing: string[] }) {
  const { busy, error, send } = usePost();
  return (
    <div>
      <button type="button" className="btn btn-primary w-full sm:w-auto" disabled={busy || !ready}
              onClick={() => send(`/api/v1/broker/assignments/${assignmentId}/transition`, { to_status: "confirmed" })}>
        Confirm assignment
      </button>
      {!ready && <p className="mt-2 text-sm text-attention">Show the current brokerage amount to the {missing.join(" and ")} before confirming.</p>}
      <ErrorText error={error} />
    </div>
  );
}

export function CancelAssignment({ assignmentId }: { assignmentId: string }) {
  const { busy, error, send } = usePost();
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" className="btn btn-ghost text-critical" onClick={() => setOpen(true)}>Cancel assignment</button>;
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); send(`/api/v1/broker/assignments/${assignmentId}/transition`, { to_status: "cancelled", reason }); }}>
      <div className="flex-1"><label className="label" htmlFor="cancel-reason">Reason</label>
        <input id="cancel-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
      <button className="btn btn-secondary" disabled={busy || !reason.trim()}>Cancel and free the bed</button>
      <div className="w-full"><ErrorText error={error} /></div>
    </form>
  );
}

export function PaymentForm({ brokerageId, outstanding }: { brokerageId: string; outstanding: number }) {
  const { busy, error, send } = usePost();
  const [amount, setAmount] = useState(String(outstanding));
  const [method, setMethod] = useState("upi");
  const [reference, setReference] = useState("");
  return (
    <form className="grid gap-2 sm:grid-cols-[120px_150px_1fr_auto] sm:items-end" onSubmit={async (e) => {
      e.preventDefault();
      if (await send(`/api/v1/broker/brokerages/${brokerageId}/payments`, { amount, method, reference: reference || undefined })) setReference("");
    }}>
      <div><label className="label" htmlFor={`amt-${brokerageId}`}>Amount (₹)</label>
        <input id={`amt-${brokerageId}`} className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
      <div><label className="label" htmlFor={`m-${brokerageId}`}>Method</label>
        <select id={`m-${brokerageId}`} className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="upi">UPI</option><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option>
        </select></div>
      <div><label className="label" htmlFor={`ref-${brokerageId}`}>Reference {method === "cash" ? "(optional)" : "(UPI ref / UTR)"}</label>
        <input id={`ref-${brokerageId}`} className="input" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
      <button className="btn btn-primary" disabled={busy}>Record payment</button>
      <div className="sm:col-span-4"><ErrorText error={error} /></div>
    </form>
  );
}
