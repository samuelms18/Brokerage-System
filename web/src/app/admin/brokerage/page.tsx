import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/page-auth";
import { lookups, store } from "@/lib/server/store";
import { BrokerageAdminActions, DeactivatePolicy, PolicyForm } from "@/components/admin/actions";
import { PROPERTY_TYPE_LABEL, formatDateTime, inr, sentence } from "@/lib/format";
import type { BrokeragePolicy } from "@/lib/server/model";

export const metadata: Metadata = { title: "Brokerage" };

const calcText = (c: BrokeragePolicy["student"]) => !c ? "—"
  : c.calcType === "flat" ? inr(c.value) : c.calcType === "percent_of_monthly_rent" ? `${c.value}% of monthly rent` : `${c.value} month(s) of rent`;

export default async function AdminBrokerage() {
  await requireAdminPage("/admin/brokerage");
  const s = store();
  const scope = (p: BrokeragePolicy) => [p.areaId ? lookups.areas.find((a) => a.id === p.areaId)?.name : "All areas", p.propertyType ? PROPERTY_TYPE_LABEL[p.propertyType] : "all types"].join(" · ");
  const active = s.policies.filter((p) => p.isActive);
  const history = s.policies.filter((p) => !p.isActive);
  const brokers = [...s.brokers.values()].map((b) => ({ id: b.userId, name: s.users.get(b.userId)!.name }));
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <h1 className="text-2xl font-bold">Brokerage</h1>

      <section className="card p-5" aria-labelledby="pol-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="pol-h" className="font-semibold">Policies</h2>
          <PolicyForm areas={lookups.areas} />
        </div>
        <p className="mt-1 text-sm text-muted">The active policy with the highest priority applies; on a tie, the more specific scope wins. Property- and assignment-level overrides take precedence.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line text-muted"><tr><th className="p-2">Policy</th><th className="p-2">Scope</th><th className="p-2">Priority</th><th className="p-2">Student pays</th><th className="p-2">Owner pays</th><th className="p-2" /></tr></thead>
            <tbody className="divide-y divide-line">
              {active.map((p) => (
                <tr key={p.id} className="align-top">
                  <td className="p-2 font-semibold">{p.name}</td><td className="p-2">{scope(p)}</td><td className="p-2">{p.priority}</td>
                  <td className="p-2">{calcText(p.student)}</td><td className="p-2">{calcText(p.owner)}</td>
                  <td className="p-2"><div className="flex flex-wrap gap-1"><PolicyForm replaces={{ id: p.id, name: p.name }} areas={lookups.areas} defaults={{ name: p.name, payerMode: p.payerMode, areaId: p.areaId, propertyType: p.propertyType, priority: p.priority }} /><DeactivatePolicy id={p.id} /></div></td>
                </tr>
              ))}
              {active.length === 0 && <tr><td colSpan={6} className="p-2 text-attention">No active policy: new assignments will have no brokerage.</td></tr>}
            </tbody>
          </table>
        </div>
        {history.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer font-semibold">Previous versions ({history.length})</summary>
            <ul className="mt-2 space-y-1 text-muted">{history.map((p) => <li key={p.id}>{p.name}: {scope(p)}; student {calcText(p.student)}; owner {calcText(p.owner)}</li>)}</ul>
          </details>
        )}
      </section>

      <section className="card overflow-x-auto" aria-labelledby="led-h">
        <h2 id="led-h" className="p-5 pb-0 font-semibold">Ledger</h2>
        <table className="mt-3 w-full min-w-[860px] text-left text-sm">
          <thead className="border-y border-line text-muted"><tr><th className="p-3">Assignment</th><th className="p-3">Party</th><th className="p-3">Amount</th><th className="p-3">Paid / refunded</th><th className="p-3">Status</th><th className="p-3">Credited to</th><th className="p-3">Actions</th></tr></thead>
          <tbody className="divide-y divide-line">
            {s.brokerages.map((r) => {
              const a = s.assignments.find((x) => x.id === r.assignmentId)!;
              const pending = s.refunds.find((x) => x.brokerageId === r.id && x.status === "pending");
              const refundable = r.paidAmount - r.refundedAmount;
              return (
                <tr key={r.id} className="align-top">
                  <td className="p-3"><span className="font-semibold">{a.code}</span><span className="block text-xs text-muted">{s.users.get(a.studentId)?.name}</span></td>
                  <td className="p-3 capitalize">{r.party}</td>
                  <td className="p-3">{inr(r.amount)}<span className="block text-xs text-muted">{r.calcSnapshot.explanation}</span></td>
                  <td className="p-3">{inr(r.paidAmount)}{r.refundedAmount > 0 && <span className="block text-xs text-muted">refunded {inr(r.refundedAmount)}</span>}{pending && <span className="block text-xs text-attention">refund of {inr(pending.amount)} pending</span>}</td>
                  <td className="p-3">{sentence(r.status)}{r.waivedReason && <span className="block text-xs text-muted">“{r.waivedReason}”</span>}</td>
                  <td className="p-3">{s.users.get(r.creditedBrokerId)?.name}
                    {r.creditHistory.length > 1 && <span className="block text-xs text-muted">changed {formatDateTime(new Date(r.creditHistory.at(-1)!.at).toISOString())}: “{r.creditHistory.at(-1)!.reason}”</span>}</td>
                  <td className="p-3"><BrokerageAdminActions id={r.id} status={r.status} refundable={refundable} brokers={brokers} credited={r.creditedBrokerId} pendingRefundId={pending?.id ?? null} /></td>
                </tr>
              );
            })}
            {s.brokerages.length === 0 && <tr><td colSpan={7} className="p-3 text-muted">No brokerage records yet. They are created when a broker confirms an assignment.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
