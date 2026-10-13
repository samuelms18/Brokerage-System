import type { Metadata } from "next";
import Link from "next/link";
import { requireBrokerPage } from "@/lib/page-auth";
import { brokerBrokerages } from "@/lib/server/broker";
import { store } from "@/lib/server/store";
import { inr, sentence } from "@/lib/format";

export const metadata: Metadata = { title: "Brokerage" };

export default async function BrokerageLedger() {
  const { user } = await requireBrokerPage("/broker/brokerage");
  const s = store();
  const rows = brokerBrokerages(user.id);
  const outstanding = rows.filter((r) => ["pending", "partially_paid"].includes(r.status)).reduce((n, r) => n + r.amount - r.paidAmount, 0);
  const collected = rows.reduce((n, r) => n + r.paidAmount, 0);
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="text-2xl font-bold">Brokerage credited to you</h1>
      <p className="mt-1 text-sm text-muted">One row per paying party. Credit stays with the broker who confirmed the assignment, even if the lead is reassigned.</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="card p-4"><p className="text-sm text-muted">Outstanding</p><p className="text-xl font-bold">{inr(outstanding)}</p></div>
        <div className="card p-4"><p className="text-sm text-muted">Collected</p><p className="text-xl font-bold">{inr(collected)}</p></div>
      </div>
      {rows.length === 0 ? (
        <p className="card mt-4 p-6 text-sm text-muted">No brokerage yet. Records appear when you confirm an assignment.</p>
      ) : (
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr><th className="p-3 font-semibold">Assignment</th><th className="p-3 font-semibold">Party</th><th className="p-3 font-semibold">Amount</th><th className="p-3 font-semibold">Paid</th><th className="p-3 font-semibold">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => {
                const a = s.assignments.find((x) => x.id === r.assignmentId)!;
                return (
                  <tr key={r.id}>
                    <td className="p-3"><Link className="font-semibold text-brand-700" href={`/broker/assignments/${a.id}`}>{a.code}</Link><span className="block text-xs text-muted">{s.users.get(a.studentId)?.name}</span></td>
                    <td className="p-3 capitalize">{r.party}</td>
                    <td className="p-3">{inr(r.amount)}</td>
                    <td className="p-3">{inr(r.paidAmount)}</td>
                    <td className="p-3">{sentence(r.status)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
