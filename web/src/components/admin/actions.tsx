"use client";

import { useState } from "react";
import { ErrorText, toIso, tomorrowAt, usePost } from "@/components/broker/usePost";

export function LoadDemo() {
  const { busy, error, send } = usePost();
  return (
    <div>
      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => send("/api/prototype/demo-activity")}>Load sample activity</button>
      <ErrorText error={error} />
    </div>
  );
}

export function VerifyProperty({ propertyId }: { propertyId: string }) {
  const { busy, error, send } = usePost();
  const [checked, setChecked] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  return (
    <div className="space-y-3">
      {!rejecting ? (
        <>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1 h-4 w-4" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
            <span>I checked the public photos: no house number, gate signboard or owner is visible, and the listing details match.</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" disabled={busy || !checked}
                    onClick={() => send(`/api/v1/admin/properties/${propertyId}/verification`, { decision: "publish", photos_checked: checked })}>Approve and publish</button>
            <button type="button" className="btn btn-secondary" onClick={() => setRejecting(true)}>Send back</button>
          </div>
        </>
      ) : (
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); send(`/api/v1/admin/properties/${propertyId}/verification`, { decision: "reject", note }); }}>
          <label className="label" htmlFor={`note-${propertyId}`}>What needs fixing? (sent to the broker)</label>
          <input id={`note-${propertyId}`} className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Photo 1 shows the gate number" />
          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={busy || note.trim().length < 3}>Send back to draft</button>
            <button type="button" className="btn btn-ghost" onClick={() => setRejecting(false)}>Back</button>
          </div>
        </form>
      )}
      <ErrorText error={error} />
    </div>
  );
}

export function Reassign({ leadId, brokers, suggested }: { leadId: string; brokers: { id: string; name: string; note: string }[]; suggested: string[] }) {
  const { busy, error, send } = usePost();
  const [brokerId, setBrokerId] = useState(suggested[0] ?? brokers[0]?.id ?? "");
  const [note, setNote] = useState("");
  return (
    <form className="grid gap-2 sm:grid-cols-[260px_1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); send(`/api/v1/admin/leads/${leadId}/reassign`, { broker_id: brokerId, reason_note: note }); }}>
      <div><label className="label" htmlFor={`rb-${leadId}`}>Assign to</label>
        <select id={`rb-${leadId}`} className="input" value={brokerId} onChange={(e) => setBrokerId(e.target.value)}>
          {brokers.map((b) => <option key={b.id} value={b.id}>{b.name}{suggested.includes(b.id) ? " (eligible)" : ` (${b.note})`}</option>)}
        </select></div>
      <div><label className="label" htmlFor={`rn-${leadId}`}>Reason (required)</label>
        <input id={`rn-${leadId}`} className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Neha is back early" /></div>
      <button className="btn btn-primary" disabled={busy || note.trim().length < 5}>Reassign</button>
      <div className="sm:col-span-3"><ErrorText error={error} /></div>
    </form>
  );
}

export function BrokerControls({ brokerId, accepting, capacity, canOverride }: { brokerId: string; accepting: boolean; capacity: number; canOverride: boolean }) {
  const { busy, error, send } = usePost();
  const [cap, setCap] = useState(String(capacity));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div><label className="label" htmlFor={`cap-${brokerId}`}>Max active leads</label>
          <input id={`cap-${brokerId}`} className="input w-24" inputMode="numeric" value={cap} onChange={(e) => setCap(e.target.value)} /></div>
        <button type="button" className="btn btn-secondary" disabled={busy || cap === String(capacity)} onClick={() => send(`/api/v1/admin/brokers/${brokerId}`, { max_active_leads: Number(cap) }, "PATCH")}>Save</button>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4" checked={accepting} disabled={busy} onChange={(e) => send(`/api/v1/admin/brokers/${brokerId}`, { accepting_leads: e.target.checked }, "PATCH")} />
        Receiving new leads
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4" checked={canOverride} disabled={busy} onChange={(e) => send(`/api/v1/admin/users/${brokerId}/permissions`, { can_override_brokerage: e.target.checked }, "PATCH")} />
        May override brokerage <span className="text-xs text-muted">(who should: open question BR-1)</span>
      </label>
      <ErrorText error={error} />
    </div>
  );
}

export function LeaveForm({ brokerId }: { brokerId: string }) {
  const { busy, error, send } = usePost();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(tomorrowAt(9));
  const [to, setTo] = useState(tomorrowAt(21));
  const [kind, setKind] = useState("leave");
  const [reason, setReason] = useState("");
  if (!open) return <button type="button" className="btn btn-ghost px-2" onClick={() => setOpen(true)}>+ Add leave / unavailable time</button>;
  return (
    <form className="card space-y-2 bg-canvas p-3" onSubmit={async (e) => {
      e.preventDefault();
      if (await send(`/api/v1/admin/brokers/${brokerId}/unavailability`, { kind, starts_at: toIso(from), ends_at: toIso(to), reason })) setOpen(false);
    }}>
      <div className="grid gap-2 sm:grid-cols-3">
        <div><label className="label" htmlFor={`k-${brokerId}`}>Type</label>
          <select id={`k-${brokerId}`} className="input" value={kind} onChange={(e) => setKind(e.target.value)}><option value="leave">Leave</option><option value="unavailable">Unavailable</option></select></div>
        <div><label className="label" htmlFor={`f-${brokerId}`}>From</label><input id={`f-${brokerId}`} type="datetime-local" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label className="label" htmlFor={`t-${brokerId}`}>To</label><input id={`t-${brokerId}`} type="datetime-local" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>
      <input aria-label="Reason (optional)" className="input" placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <p className="text-xs text-muted">Leads offered to this broker but not yet accepted move to other brokers when the leave starts.</p>
      <div className="flex gap-2"><button className="btn btn-primary" disabled={busy}>Save</button><button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button></div>
      <ErrorText error={error} />
    </form>
  );
}

export function CancelLeave({ id }: { id: string }) {
  const { busy, error, send } = usePost();
  return (<><button type="button" className="text-xs font-semibold text-critical underline" disabled={busy} onClick={() => send(`/api/v1/admin/unavailability/${id}/cancel`)}>End now</button><ErrorText error={error} /></>);
}

type CalcType = "flat" | "percent_of_monthly_rent" | "months_of_rent";
const CALCS: [CalcType, string][] = [["flat", "Fixed amount (₹)"], ["percent_of_monthly_rent", "% of monthly rent"], ["months_of_rent", "Months of rent"]];

function CalcFields({ who, calc, setCalc, value, setValue }: { who: string; calc: CalcType; setCalc: (c: CalcType) => void; value: string; setValue: (v: string) => void }) {
  return (
    <fieldset className="grid gap-2 sm:grid-cols-2">
      <legend className="label">{who} pays</legend>
      <select aria-label={`${who} calculation`} className="input" value={calc} onChange={(e) => setCalc(e.target.value as CalcType)}>
        {CALCS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <input aria-label={`${who} value`} className="input" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)}
             placeholder={calc === "flat" ? "e.g. 2000" : calc === "percent_of_monthly_rent" ? "e.g. 50" : "e.g. 1"} />
    </fieldset>
  );
}

export function PolicyForm({ replaces, areas, defaults }: { replaces?: { id: string; name: string }; areas: { id: string; name: string }[]; defaults?: { name: string; payerMode: string; areaId: string | null; propertyType: string | null; priority: number } }) {
  const { busy, error, send } = usePost();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaults?.name ?? "");
  const [payer, setPayer] = useState(defaults?.payerMode ?? "student");
  const [areaId, setAreaId] = useState(defaults?.areaId ?? "");
  const [ptype, setPtype] = useState(defaults?.propertyType ?? "");
  const [priority, setPriority] = useState(String(defaults?.priority ?? 0));
  const [sCalc, setSCalc] = useState<CalcType>("months_of_rent");
  const [sVal, setSVal] = useState("");
  const [oCalc, setOCalc] = useState<CalcType>("flat");
  const [oVal, setOVal] = useState("");
  if (!open) return <button type="button" className={replaces ? "btn btn-ghost px-2 text-sm" : "btn btn-primary"} onClick={() => setOpen(true)}>{replaces ? "Change…" : "New policy"}</button>;
  const pays = (p: string) => payer === p || payer === "both";
  return (
    <form className="card space-y-3 p-4" onSubmit={async (e) => {
      e.preventDefault();
      const ok = await send("/api/v1/admin/brokerage-policies", {
        name, payer_mode: payer, area_id: areaId || null, property_type: ptype || null, priority: Number(priority),
        student: pays("student") ? { calc_type: sCalc, value: sVal } : null, owner: pays("owner") ? { calc_type: oCalc, value: oVal } : null,
        replaces_policy_id: replaces?.id,
      });
      if (ok) setOpen(false);
    }}>
      <p className="text-sm font-semibold">{replaces ? `New version of “${replaces.name}”` : "New brokerage policy"}</p>
      {replaces && <p className="text-xs text-muted">Saving creates a new policy and deactivates the old one. Brokerage already created keeps its original calculation.</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        <div><label className="label" htmlFor="pol-name">Name</label><input id="pol-name" className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="label" htmlFor="pol-payer">Who pays</label>
          <select id="pol-payer" className="input" value={payer} onChange={(e) => setPayer(e.target.value)}><option value="student">Student</option><option value="owner">Owner</option><option value="both">Both</option></select></div>
        <div><label className="label" htmlFor="pol-area">Area</label>
          <select id="pol-area" className="input" value={areaId} onChange={(e) => setAreaId(e.target.value)}><option value="">All areas</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
        <div><label className="label" htmlFor="pol-type">Property type</label>
          <select id="pol-type" className="input" value={ptype} onChange={(e) => setPtype(e.target.value)}>
            <option value="">All types</option><option value="pg">PG</option><option value="hostel">Hostel</option><option value="flat">Shared flat</option><option value="independent_room">Independent room</option><option value="shared_house">Shared house</option>
          </select></div>
        <div><label className="label" htmlFor="pol-prio">Priority (higher wins)</label><input id="pol-prio" className="input" inputMode="numeric" value={priority} onChange={(e) => setPriority(e.target.value)} /></div>
      </div>
      {pays("student") && <CalcFields who="Student" calc={sCalc} setCalc={setSCalc} value={sVal} setValue={setSVal} />}
      {pays("owner") && <CalcFields who="Owner" calc={oCalc} setCalc={setOCalc} value={oVal} setValue={setOVal} />}
      <div className="flex gap-2"><button className="btn btn-primary" disabled={busy}>Save policy</button><button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button></div>
      <ErrorText error={error} />
    </form>
  );
}

export function DeactivatePolicy({ id }: { id: string }) {
  const { busy, error, send } = usePost();
  return (<><button type="button" className="btn btn-ghost px-2 text-sm text-critical" disabled={busy} onClick={() => send(`/api/v1/admin/brokerage-policies/${id}/deactivate`)}>Deactivate</button><ErrorText error={error} /></>);
}

/** Waive / refund / change credit for one brokerage record. */
export function BrokerageAdminActions({ id, status, refundable, brokers, credited, pendingRefundId }: {
  id: string; status: string; refundable: number; brokers: { id: string; name: string }[]; credited: string; pendingRefundId: string | null;
}) {
  const { busy, error, send } = usePost();
  const [mode, setMode] = useState<null | "waive" | "refund" | "credit" | "complete" | "cancel">(null);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState(String(refundable));
  const [broker, setBroker] = useState(brokers.find((b) => b.id !== credited)?.id ?? "");
  const [method, setMethod] = useState("upi");
  const [ref, setRef] = useState("");
  const done = async (p: Promise<unknown>) => { if (await p) { setMode(null); setReason(""); setRef(""); } };
  const canWaive = ["pending", "partially_paid"].includes(status);
  return (
    <div className="text-sm">
      {!mode && (
        <div className="flex flex-wrap gap-1">
          {canWaive && <button type="button" className="btn btn-ghost h-9 min-h-0 px-2" onClick={() => setMode("waive")}>Waive</button>}
          {refundable > 0 && !pendingRefundId && <button type="button" className="btn btn-ghost h-9 min-h-0 px-2" onClick={() => setMode("refund")}>Refund</button>}
          {pendingRefundId && <button type="button" className="btn btn-ghost h-9 min-h-0 px-2" onClick={() => setMode("complete")}>Mark refund paid</button>}
          {pendingRefundId && <button type="button" className="btn btn-ghost h-9 min-h-0 px-2" onClick={() => setMode("cancel")}>Cancel refund</button>}
          <button type="button" className="btn btn-ghost h-9 min-h-0 px-2" onClick={() => setMode("credit")}>Change credit</button>
        </div>
      )}
      {mode && (
        <form className="mt-2 space-y-2 rounded-lg bg-canvas p-3" onSubmit={(e) => {
          e.preventDefault();
          if (mode === "waive") done(send(`/api/v1/admin/brokerages/${id}/waive`, { reason }));
          if (mode === "refund") done(send(`/api/v1/admin/brokerages/${id}/refunds`, { amount, reason }));
          if (mode === "credit") done(send(`/api/v1/admin/brokerages/${id}/credit`, { broker_id: broker, reason }));
          if (mode === "complete") done(send(`/api/v1/admin/refunds/${pendingRefundId}/complete`, { method, reference: ref || undefined }));
          if (mode === "cancel") done(send(`/api/v1/admin/refunds/${pendingRefundId}/cancel`, { reason }));
        }}>
          {mode === "waive" && <p className="text-xs text-muted">Waives the whole outstanding balance. Partial waivers and who else may waive are open (BR-2).</p>}
          {mode === "refund" && <input aria-label="Refund amount" className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />}
          {mode === "credit" && (
            <select aria-label="Credit to" className="input" value={broker} onChange={(e) => setBroker(e.target.value)}>
              {brokers.filter((b) => b.id !== credited).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          {mode === "complete" ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <select aria-label="Refund method" className="input" value={method} onChange={(e) => setMethod(e.target.value)}><option value="upi">UPI</option><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option></select>
              <input aria-label="Refund reference" className="input" placeholder="UPI ref / UTR" value={ref} onChange={(e) => setRef(e.target.value)} />
            </div>
          ) : (
            <input aria-label="Reason" className="input" placeholder="Reason (required, kept in history)" value={reason} onChange={(e) => setReason(e.target.value)} />
          )}
          <div className="flex gap-2">
            <button className="btn btn-primary h-9 min-h-0" disabled={busy}>Save</button>
            <button type="button" className="btn btn-ghost h-9 min-h-0" onClick={() => setMode(null)}>Back</button>
          </div>
          <ErrorText error={error} />
        </form>
      )}
    </div>
  );
}
