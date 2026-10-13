import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/page-auth";
import { store } from "@/lib/server/store";
import { isActiveLead } from "@/lib/server/model";
import { brokerOverview, suggestedBrokers } from "@/lib/server/admin";
import { Reassign } from "@/components/admin/actions";
import { leadLabel } from "@/components/broker/ui";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Lead history" };

const REASON: Record<string, string> = {
  property_broker: "Property's own broker", authorized_fallback: "Another authorized broker", queue_retry: "Picked up from the queue",
  no_eligible_broker: "No eligible broker: moved to the queue", broker_unavailable: "Broker became unavailable", response_timeout: "Response window missed",
  broker_declined: "Broker declined", manual_reassignment: "Manual reassignment",
};

export default async function LeadHistory({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdminPage(`/admin/leads/${id}`);
  const s = store();
  const lead = s.leads.find((l) => l.id === id);
  if (!lead) notFound();
  const name = (u: string | null) => (u ? s.users.get(u)?.name ?? u : "Unassigned Queue");
  const brokers = brokerOverview().map((b) => ({ id: b.broker.userId, name: b.user.name, note: b.currentLeave ? "on leave" : `${b.activeLeads}/${b.broker.maxActiveLeads} leads` }));
  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <Link href="/admin/allocation" className="text-sm font-semibold text-brand-700">← Allocation</Link>
      <header>
        <p className="text-sm text-muted">{lead.code} · {leadLabel(lead.status)}</p>
        <h1 className="text-2xl font-bold">{name(lead.studentId)} → {s.properties.find((p) => p.id === lead.propertyId)?.title}</h1>
      </header>
      <section className="card p-5" aria-labelledby="hist-h">
        <h2 id="hist-h" className="font-semibold">Assignment history</h2>
        <ol className="mt-3 space-y-3 border-l-2 border-line pl-4">
          {lead.assignments.map((e, i) => (
            <li key={i} className="text-sm">
              <p className="font-semibold">{name(e.previousBrokerId === null && i === 0 ? null : e.previousBrokerId)} → {name(e.newBrokerId)}</p>
              <p className="text-muted">{REASON[e.reason] ?? e.reason} · {e.method === "manual" ? "Manual" : "Automatic"} · {formatDateTime(new Date(e.at).toISOString())}</p>
              {e.note && <p className="italic text-muted">“{e.note}”</p>}
              {e.responseDueAt && <p className="text-xs text-muted">Response due {formatDateTime(new Date(e.responseDueAt).toISOString())}{e.acceptedAt ? ` · accepted ${formatDateTime(new Date(e.acceptedAt).toISOString())}` : ""}</p>}
            </li>
          ))}
        </ol>
      </section>
      {isActiveLead(lead) && (
        <section className="card p-5" aria-labelledby="re-h">
          <h2 id="re-h" className="mb-1 font-semibold">Reassign manually</h2>
          <p className="mb-3 text-sm text-muted">For exceptions only. The new broker gets the lead as accepted; brokerage credit is not affected.</p>
          <Reassign leadId={lead.id} brokers={brokers.filter((b) => b.id !== lead.brokerId)} suggested={suggestedBrokers(lead)} />
        </section>
      )}
    </div>
  );
}
