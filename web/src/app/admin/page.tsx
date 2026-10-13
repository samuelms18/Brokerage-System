import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/page-auth";
import { store } from "@/lib/server/store";
import { isActiveLead } from "@/lib/server/model";
import { brokerOverview, unassignedQueue } from "@/lib/server/admin";
import { Kpi } from "@/components/broker/ui";
import { LoadDemo } from "@/components/admin/actions";
import { inr } from "@/lib/format";

export const metadata: Metadata = { title: "Overview" };

export default async function AdminOverview() {
  await requireAdminPage("/admin");
  const s = store();
  const active = s.leads.filter(isActiveLead);
  const sum = (party: string, f: (r: (typeof s.brokerages)[number]) => number) => s.brokerages.filter((r) => r.party === party).reduce((n, r) => n + f(r), 0);
  const outstanding = (r: (typeof s.brokerages)[number]) => (["pending", "partially_paid"].includes(r.status) ? r.amount - r.paidAmount : 0);
  const brokers = brokerOverview();
  const queue = unassignedQueue();
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Overview</h1>
          <p className="text-sm text-muted">Routine lead assignment is automatic. These are the items that need you.</p>
        </div>
        {s.leads.length === 0 && process.env.PROTOTYPE_TOOLS !== "off" && (
          <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/60 p-3 text-sm">
            <p className="mb-2 font-semibold text-attention">Prototype: the server is empty</p>
            <LoadDemo />
          </div>
        )}
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Needs attention">
        <Kpi label="Unassigned Queue" value={queue.length} href="/admin/allocation" tone={queue.length ? "critical" : "default"} />
        <Kpi label="Awaiting verification" value={s.properties.filter((p) => p.status === "verification").length} href="/admin/properties" tone={s.properties.some((p) => p.status === "verification") ? "attention" : "default"} />
        <Kpi label="Brokers available now" value={`${brokers.filter((b) => b.eligibleNow).length} / ${brokers.length}`} href="/admin/brokers" />
        <Kpi label="Active leads" value={active.length} href="/admin/allocation" />
      </section>

      <section className="card p-5" aria-labelledby="money-h">
        <h2 id="money-h" className="font-semibold">Brokerage</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(["student", "owner"] as const).map((party) => (
            <div key={party} className="rounded-lg border border-line p-4">
              <p className="text-sm font-semibold capitalize">{party}s</p>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
                <div><dt className="text-muted">Collected</dt><dd className="font-semibold">{inr(sum(party, (r) => r.paidAmount - r.refundedAmount))}</dd></div>
                <div><dt className="text-muted">Outstanding</dt><dd className="font-semibold">{inr(sum(party, outstanding))}</dd></div>
                <div><dt className="text-muted">Waived</dt><dd className="font-semibold">{inr(sum(party, (r) => (r.status === "waived" ? r.amount - r.paidAmount : 0)))}</dd></div>
              </dl>
            </div>
          ))}
        </div>
        <Link href="/admin/brokerage" className="mt-3 inline-block text-sm font-semibold text-brand-700">Open brokerage ledger →</Link>
      </section>
    </div>
  );
}
