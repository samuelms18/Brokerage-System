import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/page-auth";
import { store } from "@/lib/server/store";
import { isActiveLead } from "@/lib/server/model";
import { brokerOverview, suggestedBrokers, unassignedQueue } from "@/lib/server/admin";
import { Reassign } from "@/components/admin/actions";
import { leadLabel } from "@/components/broker/ui";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Allocation" };

export default async function AllocationPage() {
  await requireAdminPage("/admin/allocation");
  const s = store();
  const queue = unassignedQueue();
  const brokers = brokerOverview().map((b) => ({ id: b.broker.userId, name: b.user.name, note: b.currentLeave ? "on leave" : !b.broker.acceptingLeads ? "not receiving" : `${b.activeLeads}/${b.broker.maxActiveLeads} leads` }));
  const active = s.leads.filter((l) => isActiveLead(l) && l.allocationStatus !== "unassigned").sort((a, b) => b.updatedAt - a.updatedAt);
  const prop = (id: string) => s.properties.find((p) => p.id === id)!;
  const name = (id: string | null) => (id ? s.users.get(id)?.name ?? id : "—");
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <h1 className="text-2xl font-bold">Allocation</h1>

      <section className="card p-5" aria-labelledby="q-h">
        <h2 id="q-h" className="font-semibold">Unassigned Queue <span className="text-muted">({queue.length})</span></h2>
        <p className="mt-1 text-sm text-muted">Leads no eligible broker could take. They retry automatically when a broker becomes available; reassign by hand only for exceptions.</p>
        {queue.length === 0 ? <p className="mt-3 text-sm text-muted">The queue is empty.</p> : (
          <ul className="mt-3 space-y-4">
            {queue.map((l) => (
              <li key={l.id} className="rounded-lg border border-red-200 bg-red-50/40 p-4">
                <div className="mb-3 flex flex-wrap justify-between gap-2">
                  <p><Link href={`/admin/leads/${l.id}`} className="font-semibold text-brand-700">{l.code}</Link> · {name(l.studentId)} · {prop(l.propertyId).title}</p>
                  <p className="text-sm text-muted">Waiting since {formatDateTime(new Date(l.queuedAt!).toISOString())}</p>
                </div>
                <Reassign leadId={l.id} brokers={brokers} suggested={suggestedBrokers(l)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card overflow-x-auto" aria-labelledby="active-h">
        <h2 id="active-h" className="p-5 pb-0 font-semibold">Active leads</h2>
        <table className="mt-3 w-full min-w-[680px] text-left text-sm">
          <thead className="border-y border-line text-muted"><tr><th className="p-3">Lead</th><th className="p-3">Student</th><th className="p-3">Property</th><th className="p-3">Broker</th><th className="p-3">State</th></tr></thead>
          <tbody className="divide-y divide-line">
            {active.map((l) => (
              <tr key={l.id}>
                <td className="p-3"><Link href={`/admin/leads/${l.id}`} className="font-semibold text-brand-700">{l.code}</Link></td>
                <td className="p-3">{name(l.studentId)}</td>
                <td className="p-3">{prop(l.propertyId).title}</td>
                <td className="p-3">{name(l.brokerId)}</td>
                <td className="p-3">{l.allocationStatus === "offered" ? <span className="text-attention">Offered · due {formatDateTime(new Date(l.responseDueAt!).toISOString())}</span> : leadLabel(l.status)}</td>
              </tr>
            ))}
            {active.length === 0 && <tr><td className="p-3 text-muted" colSpan={5}>No active leads.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
