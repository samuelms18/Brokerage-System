import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudentPage } from "@/lib/page-auth";
import { getStudentLead } from "@/lib/server/requests";
import { toStudentRequest } from "@/lib/server/student-dto";
import { StatusPill } from "@/components/StatusPill";
import { AcknowledgeButton, CancelRequestButton, ConfirmVisitButton } from "./actions";
import { STATUS_LABEL, formatDate, formatDateTime, inr, sentence } from "@/lib/format";

export const metadata: Metadata = { title: "Request" };

const STEPS = ["request_received", "broker_contacted", "visit_scheduled", "visited", "room_assigned", "moved_in"] as const;

export default async function RequestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ received?: string }> }) {
  const { id } = await params;
  const { received } = await searchParams;
  const { user, collegeId } = await requireStudentPage(`/requests/${id}`);
  const lead = getStudentLead(user.id, id);
  if (!lead) notFound();
  const r = toStudentRequest(lead, { studentId: user.id, collegeId });
  const stepIndex = STEPS.indexOf(r.display_status as (typeof STEPS)[number]);
  const closed = r.display_status === "closed";

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      {received === "1" && (
        <div role="status" className="card border-brand-200 bg-brand-50 p-5">
          <div className="flex gap-3">
            <svg aria-hidden viewBox="0 0 24 24" className="h-7 w-7 flex-none text-brand-600"><circle cx="12" cy="12" r="11" fill="currentColor" /><path d="m7 12.5 3.2 3.2L17 9" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <div>
              <h1 className="text-lg font-bold text-brand-900">Request Received</h1>
              <p className="text-brand-900">Your property request has been received. Our broker will contact you shortly.</p>
            </div>
          </div>
        </div>
      )}

      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">{r.type === "visit" ? "Visit request" : "Interest"} · sent {formatDateTime(r.created_at)}</p>
            <h2 className="text-xl font-bold"><Link href={`/p/${r.property.code}`} className="hover:underline">{r.property.title}</Link></h2>
            <p className="text-sm text-muted">{r.property.area} · from {inr(r.property.rent_from)}/month</p>
          </div>
          <StatusPill status={r.display_status} />
        </div>

        {!closed && (
          <ol className="mt-6 grid grid-cols-6 gap-1" aria-label="Progress">
            {STEPS.map((s, i) => (
              <li key={s} className="text-center">
                <div className={`h-1.5 rounded-full ${i <= stepIndex ? "bg-brand-500" : "bg-line"}`} />
                <span className={`mt-2 hidden text-[11px] sm:block ${i === stepIndex ? "font-semibold text-ink" : "text-muted"}`}>{STATUS_LABEL[s]}</span>
              </li>
            ))}
          </ol>
        )}
        {closed && <p className="mt-4 text-sm text-muted">This request is closed{r.closed_reason === "cancelled_by_you" ? " (you withdrew it)" : r.closed_reason === "property_unavailable" ? " because the property is no longer available" : ""}.</p>}
      </section>

      <section className="card p-5" aria-labelledby="broker-h">
        <h2 id="broker-h" className="font-semibold">Your broker</h2>
        {r.broker_contact ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{r.broker_contact.display_name}</p>
              <p className="text-sm text-muted">{r.broker_contact.business_phone}</p>
            </div>
            <div className="flex gap-2">
              <a className="btn btn-secondary" href={`tel:${r.broker_contact.business_phone}`}>Call</a>
              <a className="btn btn-primary" href={r.broker_contact.whatsapp_url} target="_blank" rel="noopener noreferrer">WhatsApp</a>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">
            {closed ? "No broker is assigned to this request." : "A broker will contact you shortly. Their name and number appear here once they take up your request."}
          </p>
        )}
      </section>

      {r.brokerage && (
        <section className="card p-5" aria-labelledby="brk-h">
          <h2 id="brk-h" className="font-semibold">Brokerage</h2>
          <p className="mt-2 text-2xl font-bold">{inr(r.brokerage.amount)}</p>
          <p className="text-sm text-muted">{r.brokerage.explanation}</p>
          <p className="mt-2 text-sm">Status: <span className="font-semibold">{sentence(r.brokerage.status)}</span>{Number(r.brokerage.paid_amount) > 0 && ` · Paid ${inr(r.brokerage.paid_amount ?? 0)}`}</p>
          <div className="mt-4">
            {r.brokerage.acknowledged ? (
              <p className="text-sm font-semibold text-success">You have acknowledged this amount.</p>
            ) : (
              <AcknowledgeButton requestId={r.id} />
            )}
          </div>
        </section>
      )}

      {r.visits.length > 0 && (
        <section className="card p-5" aria-labelledby="visits-h">
          <h2 id="visits-h" className="font-semibold">Visit</h2>
          <ul className="mt-3 space-y-3">
            {r.visits.map((v) => (
              <li key={v.id} className="text-sm">
                <p className="font-semibold">{sentence(v.status)} · {v.people_count} {v.people_count === 1 ? "person" : "people"}</p>
                {v.scheduled_at
                  ? <>
                      <p>{v.status === "proposed" || v.status === "rescheduled" ? "Your broker proposed" : "Scheduled for"} <strong>{formatDateTime(v.scheduled_at)}</strong></p>
                      {(v.status === "proposed" || v.status === "rescheduled") && <ConfirmVisitButton visitId={v.id} />}
                    </>
                  : <p className="text-muted">Your preferred times: {v.preferred_slots?.map((s) => `${formatDate(s.date, { weekday: "short", day: "numeric", month: "short" })} ${s.from ?? ""}–${s.to ?? ""}`).join(", ")}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card p-5" aria-labelledby="tl-h">
        <h2 id="tl-h" className="font-semibold">Timeline</h2>
        <ol className="mt-3 space-y-3 border-l-2 border-line pl-4">
          {[...(r.timeline ?? [])].reverse().map((t, i) => (
            <li key={i} className="text-sm">
              <p className="font-medium">{t.label}</p>
              <p className="text-xs text-muted">{t.at ? formatDateTime(t.at) : ""}</p>
            </li>
          ))}
        </ol>
      </section>

      {!closed && !["room_assigned", "moved_in"].includes(r.display_status) && <CancelRequestButton requestId={r.id} />}
      {process.env.PROTOTYPE_TOOLS !== "off" && !closed && !r.broker_contact && (
        <aside className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/60 p-4 text-sm" aria-label="Prototype note">
          <p className="font-semibold text-attention">Prototype demo</p>
          <p className="mt-1 text-muted">To act as the broker, open a private window and log in with <strong>98000 00011</strong> (Asha, broker for North Campus), <strong>98000 00012</strong> (Ravi) or <strong>98000 00013</strong> (Neha). The code is 123456.</p>
        </aside>
      )}
    </div>
  );
}
