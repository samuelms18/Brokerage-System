import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBrokerPage } from "@/lib/page-auth";
import { BrokerError, brokerAssignment } from "@/lib/server/broker";
import { quoteView } from "@/lib/server/brokerage-dto";
import { readyToConfirm, recordsFor } from "@/lib/server/brokerage";
import { audit, store } from "@/lib/server/store";
import { CancelAssignment, ConfirmAssignment, DiscloseButtons, OverrideForm, PaymentForm } from "@/components/broker/actions";
import { formatDate, formatDateTime, inr, sentence } from "@/lib/format";

export const metadata: Metadata = { title: "Assignment" };

const SOURCE: Record<string, string> = { policy: "Policy", property_override: "Property override", assignment_override: "Assignment override" };
const METHOD: Record<string, string> = { in_app: "in the app", whatsapp: "on WhatsApp", phone: "by phone", in_person: "in person", email: "by email" };

export default async function AssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireBrokerPage(`/broker/assignments/${id}`);
  let found;
  try { found = brokerAssignment(user.id, id); } catch (e) { if (e instanceof BrokerError) notFound(); throw e; }
  const { a, lead } = found;
  const s = store();
  const p = s.properties.find((x) => x.id === a.propertyId)!;
  const room = p.rooms.find((r) => r.id === a.roomId)!;
  const bed = room.beds.find((b) => b.id === a.bedId)!;
  const owner = s.owners.get(p.private.ownerId)!;
  audit(user.id, "owner.viewed", "property", p.id); // every view of owner details is audited
  const q = quoteView(a);
  const { missing } = readyToConfirm(a);
  const pre = ["draft", "pending_confirmation", "reserved"].includes(a.status);
  const records = recordsFor(a.id);
  const canOverride = s.users.get(user.id)?.role === "super_admin" || !!s.users.get(user.id)?.canOverrideBrokerage;
  const overrides = s.overrides.filter((o) => o.assignmentId === a.id).sort((x, y) => y.createdAt - x.createdAt);

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <Link href={`/broker/leads/${lead.id}`} className="text-sm font-semibold text-brand-700">← Lead {lead.code}</Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{a.code} · created {formatDateTime(new Date(a.createdAt).toISOString())}</p>
          <h1 className="text-2xl font-bold">{s.users.get(a.studentId)?.name} → {p.title}</h1>
          <p className="text-sm text-muted">{room.label} · Bed {bed.label}{a.moveInDate ? ` · Move-in ${formatDate(a.moveInDate, { day: "numeric", month: "long" })}` : ""}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${a.status === "confirmed" ? "bg-green-50 text-success" : a.status === "cancelled" ? "bg-gray-100 text-muted" : "bg-amber-50 text-attention"}`}>{sentence(a.status)}</span>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-5">
          <section className="card p-5" aria-labelledby="snap-h">
            <h2 id="snap-h" className="font-semibold">Commercial terms</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div><dt className="text-muted">Monthly rent</dt><dd className="font-semibold">{inr(a.rentSnapshot)}</dd></div>
              <div><dt className="text-muted">Deposit</dt><dd className="font-semibold">{inr(a.depositSnapshot)}</dd></div>
              <div><dt className="text-muted">Snapshot</dt><dd>{a.confirmedAt ? "Frozen at confirmation" : "Frozen when confirmed"}</dd></div>
            </dl>
          </section>

          <section className="card p-5" aria-labelledby="brk-h">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="brk-h" className="font-semibold">Brokerage</h2>
              {pre && <p className="text-xs text-muted">Each paying party must be shown their amount before you confirm.</p>}
            </div>

            {pre ? (
              <>
                {(q.lines ?? []).length === 0 && <p className="mt-3 text-sm text-muted">No brokerage is charged for this assignment.</p>}
                <ul className="mt-3 space-y-3">
                  {(q.lines ?? []).map((l) => (
                    <li key={l.party} className="rounded-lg border border-line p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold capitalize">{l.party}</p>
                          <p className="text-2xl font-bold">{inr(l.amount!)}</p>
                          <p className="text-sm text-muted">{l.explanation} · {SOURCE[l.source!]}</p>
                        </div>
                        {l.disclosure?.matches_quote
                          ? <span className="whitespace-nowrap rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-success">Shown {METHOD[l.disclosure.method!]}{l.disclosure.acknowledged_at ? " · acknowledged" : ""}</span>
                          : <span className="whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-attention">{l.disclosure ? "Amount changed, show again" : "Not shown yet"}</span>}
                      </div>
                      {!l.disclosure?.matches_quote && <div className="mt-3"><DiscloseButtons assignmentId={a.id} party={l.party!} /></div>}
                    </li>
                  ))}
                </ul>
                {canOverride && <div className="mt-3"><OverrideForm assignmentId={a.id} /></div>}
                {overrides.length > 0 && (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer font-semibold">Override history ({overrides.length})</summary>
                    <ul className="mt-2 space-y-1 text-muted">
                      {overrides.map((o) => (
                        <li key={o.id}>{formatDateTime(new Date(o.createdAt).toISOString())}: {o.party}, {o.calcType === "not_charged" ? "not charged" : `${sentence(o.calcType)} ${o.value}`}. “{o.reason}”{o.revokedAt ? ` (revoked: ${o.revokeReason})` : ""}</li>
                      ))}
                    </ul>
                  </details>
                )}
                <div className="mt-5 border-t border-line pt-5"><ConfirmAssignment assignmentId={a.id} ready={missing.length === 0} missing={missing} /></div>
              </>
            ) : (
              <ul className="mt-3 space-y-3">
                {records.length === 0 && <li className="text-sm text-muted">No brokerage was charged.</li>}
                {records.map((r) => (
                  <li key={r.id} className="rounded-lg border border-line p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold capitalize">{r.party}</p>
                        <p className="text-xl font-bold">{inr(r.amount)} <span className="text-sm font-normal text-muted">· paid {inr(r.paidAmount)}</span></p>
                        <p className="text-xs text-muted">{r.calcSnapshot.explanation} · credited to {s.brokers.get(r.creditedBrokerId)?.displayName}</p>
                      </div>
                      <span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold">{sentence(r.status)}</span>
                    </div>
                    {["pending", "partially_paid"].includes(r.status) && <div className="mt-3"><PaymentForm brokerageId={r.id} outstanding={r.amount - r.paidAmount} /></div>}
                    <ul className="mt-2 text-xs text-muted">
                      {s.payments.filter((pmt) => pmt.brokerageId === r.id).map((pmt) => (
                        <li key={pmt.id}>{pmt.receiptNumber}: {inr(pmt.amount)} by {pmt.method.replace("_", " ")}{pmt.reference ? ` (${pmt.reference})` : ""}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {pre && <CancelAssignment assignmentId={a.id} />}
        </div>

        <aside>
          <section className="card border-dashed p-5" aria-labelledby="owner-h">
            <h2 id="owner-h" className="flex items-center gap-2 font-semibold">
              <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 text-muted"><path fill="currentColor" d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 0 1 6 0v3z" /></svg>
              Owner Details · Admin only
            </h2>
            <p className="mt-1 text-xs text-muted">Never shown to students. Your view is logged.</p>
            <dl className="mt-3 space-y-2 text-sm">
              <div><dt className="text-muted">Owner</dt><dd className="font-medium">{owner.name}</dd></div>
              <div><dt className="text-muted">Phone</dt><dd><a className="text-brand-700" href={`tel:${owner.phone}`}>{owner.phone}</a></dd></div>
              <div><dt className="text-muted">Exact address</dt><dd>{p.private.addressLine1}{p.private.landmark ? `, ${p.private.landmark}` : ""} {p.private.pincode}</dd></div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
