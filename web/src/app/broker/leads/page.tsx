import type { Metadata } from "next";
import Link from "next/link";
import { requireBrokerPage } from "@/lib/page-auth";
import { store } from "@/lib/server/store";
import { isActiveLead } from "@/lib/server/model";
import { toLeadSummary } from "@/lib/server/broker-dto";
import { Countdown, leadLabel } from "@/components/broker/ui";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Leads" };

const TABS = [["offered", "Awaiting acceptance"], ["active", "Active"], ["closed", "Closed"]] as const;

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "active" } = await searchParams;
  const { user } = await requireBrokerPage(`/broker/leads?tab=${tab}`);
  const mine = store().leads.filter((l) => l.brokerId === user.id);
  const filtered = mine.filter((l) => tab === "offered" ? l.allocationStatus === "offered" && isActiveLead(l)
    : tab === "closed" ? !isActiveLead(l) : l.allocationStatus === "accepted" && isActiveLead(l))
    .sort((a, b) => b.updatedAt - a.updatedAt).map(toLeadSummary);
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="text-2xl font-bold">Leads</h1>
      <nav className="mt-4 flex gap-2 overflow-x-auto" aria-label="Lead tabs">
        {TABS.map(([id, label]) => (
          <Link key={id} href={`/broker/leads?tab=${id}`} className="chip" aria-current={tab === id ? "page" : undefined} aria-pressed={tab === id}>{label}</Link>
        ))}
      </nav>
      {filtered.length === 0 ? (
        <p className="card mt-4 p-6 text-sm text-muted">No leads here.</p>
      ) : (
        <ul className="card mt-4 divide-y divide-line">
          {filtered.map((l) => (
            <li key={l.id}>
              <Link href={`/broker/leads/${l.id}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-canvas">
                <div className="min-w-0">
                  <p className="font-semibold">{l.student_name} <span className="font-normal text-muted">· {l.code}</span></p>
                  <p className="truncate text-sm text-muted">{l.property?.title}</p>
                  {l.next_follow_up && <p className="text-xs text-muted">Next: {l.next_follow_up.action} · {formatDateTime(l.next_follow_up.due_at)}</p>}
                </div>
                {l.allocation_status === "offered" ? <Countdown iso={l.response_due_at} /> : <span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold">{leadLabel(l.status ?? "")}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
