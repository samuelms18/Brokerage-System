import type { Metadata } from "next";
import Link from "next/link";
import { requireBrokerPage } from "@/lib/page-auth";
import { dashboard } from "@/lib/server/broker";
import { toLeadSummary } from "@/lib/server/broker-dto";
import { AvailabilityToggle } from "@/components/broker/actions";
import { Countdown, Kpi } from "@/components/broker/ui";
import { inr } from "@/lib/format";

export const metadata: Metadata = { title: "Broker dashboard" };

export default async function BrokerDashboard() {
  const { user, broker } = await requireBrokerPage("/broker");
  const d = dashboard(user.id);
  const c = d.counts;
  const offered = d.offered.map(toLeadSummary);
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Good to see you, {user.name.split(" ")[0]}</h1>
          <p className="text-sm text-muted">{c.active_leads} active leads · capacity {c.max_active_leads}</p>
        </div>
        {broker && <AvailabilityToggle accepting={broker.acceptingLeads} />}
      </div>

      <section aria-label="Today" className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Awaiting your acceptance" value={c.offered_awaiting_acceptance} href="/broker/leads?tab=offered" tone={c.offered_awaiting_acceptance ? "attention" : "default"} />
        <Kpi label="New leads" value={c.new_leads} href="/broker/leads?tab=active" />
        <Kpi label="Visits today" value={c.visits_today} href="/broker/leads?tab=active" />
        <Kpi label="Follow-ups overdue" value={c.follow_ups_overdue} href="/broker/leads?tab=active" tone={c.follow_ups_overdue ? "critical" : "default"} />
        <Kpi label="Assignments pending" value={c.assignments_pending} href="/broker/leads?tab=active" />
        <Kpi label="Brokerage pending" value={inr(c.brokerage_pending_amount)} href="/broker/brokerage" />
      </section>

      <section className="card p-5" aria-labelledby="offered-h">
        <h2 id="offered-h" className="font-semibold">New leads waiting for you</h2>
        {offered.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nothing waiting. New requests appear here with a response deadline; if it passes, the lead moves to another broker.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {offered.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-semibold">{l.student_name} <span className="font-normal text-muted">· {l.code}</span></p>
                  <p className="truncate text-sm text-muted">{l.property?.title} · {l.source === "visit_request" ? "Visit request" : "Interest"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Countdown iso={l.response_due_at} />
                  <Link href={`/broker/leads/${l.id}`} className="btn btn-primary">Review</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
