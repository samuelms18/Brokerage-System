import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBrokerPage } from "@/lib/page-auth";
import { BrokerError, bedsForLead, brokerLead } from "@/lib/server/broker";
import { toLeadDetail } from "@/lib/server/broker-dto";
import { store } from "@/lib/server/store";
import { isActiveLead } from "@/lib/server/model";
import { AcceptDecline, StartAssignment, StatusForm, VisitOutcome, VisitPropose } from "@/components/broker/actions";
import { Countdown, leadLabel } from "@/components/broker/ui";
import { formatDate, formatDateTime, inr, sentence, sharingLabel } from "@/lib/format";

export const metadata: Metadata = { title: "Lead" };

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireBrokerPage(`/broker/leads/${id}`);
  let lead;
  try { lead = brokerLead(user.id, id); } catch (e) { if (e instanceof BrokerError) notFound(); throw e; }
  const d = toLeadDetail(lead, user.id);
  const offered = d.allocation_status === "offered";
  const active = isActiveLead(lead);
  const assignment = store().assignments.find((a) => a.leadId === lead.id && a.status !== "cancelled");
  const beds = bedsForLead(user.id, lead.id).map(({ room, bed }) => ({
    id: bed.id, label: `${room.label} · Bed ${bed.label}`, status: bed.status,
    note: `${sharingLabel(room.sharing)} · ${inr(room.rentPerBed)}/month${bed.status !== "available" ? ` · ${bed.status}` : ""}`,
  }));
  const openVisits = (d.visits ?? []).filter((v) => ["requested", "proposed", "confirmed", "rescheduled"].includes(v.status ?? ""));

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <Link href="/broker/leads" className="text-sm font-semibold text-brand-700">← Leads</Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{d.code} · {d.source === "visit_request" ? "Visit request" : "Interest"} · {formatDateTime(d.created_at!)}</p>
          <h1 className="text-2xl font-bold">{d.student?.name}</h1>
        </div>
        {offered ? <Countdown iso={d.response_due_at} /> : <span className="rounded-full bg-canvas px-3 py-1 text-sm font-semibold">{leadLabel(d.status ?? "")}</span>}
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-5">
          {offered && (
            <section className="card border-amber-200 p-5">
              <h2 className="font-semibold">This lead is offered to you</h2>
              <p className="mt-1 text-sm text-muted">Accept to see the student&apos;s contact details and start working on it. If you don&apos;t respond in time, it moves to another broker automatically.</p>
              <div className="mt-4"><AcceptDecline leadId={d.id!} /></div>
            </section>
          )}

          <section className="card p-5" aria-labelledby="visits-h">
            <h2 id="visits-h" className="font-semibold">Visits</h2>
            {(d.visits ?? []).length === 0 && <p className="mt-2 text-sm text-muted">No visit requested yet.</p>}
            <ul className="mt-3 space-y-4">
              {(d.visits ?? []).map((v) => (
                <li key={v.id} className="rounded-lg border border-line p-4">
                  <p className="text-sm font-semibold">{sentence(v.status)} · {v.people_count} {v.people_count === 1 ? "person" : "people"}</p>
                  {v.preferred_slots && v.preferred_slots.length > 0 && (
                    <p className="text-sm text-muted">Student prefers: {v.preferred_slots.map((s) => `${formatDate(s.date, { weekday: "short", day: "numeric", month: "short" })} ${s.from ?? ""}–${s.to ?? ""}`).join(", ")}</p>
                  )}
                  {v.scheduled_at && <p className="text-sm">Scheduled: <strong>{formatDateTime(v.scheduled_at)}</strong>{v.status === "proposed" && " (waiting for the student to confirm)"}</p>}
                  {v.student_note && <p className="mt-1 text-sm italic text-muted">“{v.student_note}”</p>}
                  {!offered && active && ["requested", "proposed", "confirmed", "rescheduled"].includes(v.status ?? "") && (
                    <div className="mt-3 space-y-3">
                      <VisitPropose visitId={v.id} label={v.scheduled_at ? "Reschedule" : "Propose time"} />
                      {v.scheduled_at && <VisitOutcome visitId={v.id!} />}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {!offered && active && openVisits.length === 0 && <div className="mt-4"><VisitPropose leadId={d.id} label="Schedule a visit" /></div>}
          </section>

          {!offered && active && (
            <section className="card p-5" aria-labelledby="asg-h">
              <h2 id="asg-h" className="font-semibold">Assignment</h2>
              {assignment ? (
                <p className="mt-2 text-sm">{assignment.code} · {sentence(assignment.status)} · <Link className="font-semibold text-brand-700" href={`/broker/assignments/${assignment.id}`}>Open assignment →</Link></p>
              ) : (
                <div className="mt-3"><StartAssignment leadId={d.id!} beds={beds} /></div>
              )}
            </section>
          )}

          {!offered && active && (
            <section className="card p-5" aria-labelledby="status-h">
              <h2 id="status-h" className="mb-3 font-semibold">Update lead</h2>
              <StatusForm leadId={d.id!} />
            </section>
          )}
        </div>

        <aside className="space-y-5">
          <section className="card p-5" aria-labelledby="student-h">
            <h2 id="student-h" className="font-semibold">Student</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div><dt className="text-muted">Name</dt><dd className="font-medium">{d.student?.name}</dd></div>
              <div><dt className="text-muted">College</dt><dd>{d.student?.college ?? "Not given"}</dd></div>
              <div>
                <dt className="text-muted">Phone</dt>
                {d.student?.phone
                  ? <dd><a className="font-semibold text-brand-700" href={`tel:${d.student.phone}`}>{d.student.phone}</a></dd>
                  : <dd className="flex items-center gap-2 text-muted"><svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4"><path fill="currentColor" d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 0 1 6 0v3z" /></svg>Visible after you accept</dd>}
              </div>
            </dl>
          </section>
          <section className="card p-5">
            <h2 className="font-semibold">Property</h2>
            <p className="mt-2 text-sm font-medium">{d.property?.title}</p>
            <p className="text-sm text-muted">{d.property?.area} · {d.property?.beds_available} of {d.property?.beds_total} beds free</p>
          </section>
          <section className="card p-5" aria-labelledby="fu-h">
            <h2 id="fu-h" className="font-semibold">Follow-ups</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {(d.follow_ups ?? []).filter((f) => f.status === "open").map((f) => (
                <li key={f.id}><p className="font-medium">{f.action}</p><p className={`text-xs ${Date.parse(f.due_at!) < Date.now() ? "text-critical" : "text-muted"}`}>Due {formatDateTime(f.due_at!)}</p></li>
              ))}
              {(d.follow_ups ?? []).every((f) => f.status !== "open") && <li className="text-muted">None open</li>}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
