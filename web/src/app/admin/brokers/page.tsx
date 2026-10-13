import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/page-auth";
import { lookups } from "@/lib/server/store";
import { brokerOverview } from "@/lib/server/admin";
import { BrokerControls, CancelLeave, LeaveForm } from "@/components/admin/actions";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Brokers" };

export default async function BrokersPage() {
  await requireAdminPage("/admin/brokers");
  const rows = brokerOverview();
  const iso = (n: number) => new Date(n).toISOString();
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">Brokers</h1>
      <p className="text-sm text-muted">Availability, capacity and leave decide who gets new leads automatically.</p>
      <ul className="grid gap-4 md:grid-cols-2">
        {rows.map((r) => (
          <li key={r.broker.userId} className="card space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{r.user.name}</p>
                <p className="text-sm text-muted">{r.broker.areaIds.map((a) => lookups.areas.find((x) => x.id === a)?.name).join(", ")}</p>
              </div>
              <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${r.eligibleNow ? "bg-green-50 text-success" : "bg-amber-50 text-attention"}`}>
                {r.eligibleNow ? "Eligible now" : r.currentLeave ? "On leave" : !r.broker.acceptingLeads ? "Not receiving" : "At capacity"}
              </span>
            </div>
            <p className="text-sm">{r.activeLeads} active lead(s){r.offeredLeads ? `, ${r.offeredLeads} awaiting acceptance` : ""}</p>
            {r.currentLeave && (
              <p className="rounded-lg bg-amber-50 p-3 text-sm">On {r.currentLeave.kind} until {formatDateTime(iso(r.currentLeave.endsAt))}{r.currentLeave.reason ? ` (${r.currentLeave.reason})` : ""}. <CancelLeave id={r.currentLeave.id} /></p>
            )}
            {r.upcoming.map((w) => (
              <p key={w.id} className="text-sm text-muted">Upcoming {w.kind}: {formatDateTime(iso(w.startsAt))} to {formatDateTime(iso(w.endsAt))}. <CancelLeave id={w.id} /></p>
            ))}
            <BrokerControls brokerId={r.broker.userId} accepting={r.broker.acceptingLeads} capacity={r.broker.maxActiveLeads} canOverride={!!r.user.canOverrideBrokerage} />
            <LeaveForm brokerId={r.broker.userId} />
          </li>
        ))}
      </ul>
    </div>
  );
}
