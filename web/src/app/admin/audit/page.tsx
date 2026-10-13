import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/page-auth";
import { store } from "@/lib/server/store";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Audit log" };

const GROUPS = [["", "All"], ["lead.", "Leads"], ["brokerage.", "Brokerage"], ["payment.", "Payments"], ["owner.", "Owner views"], ["property.", "Properties"], ["broker.", "Brokers"]] as const;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  const { action = "" } = await searchParams;
  await requireAdminPage(`/admin/audit${action ? `?action=${action}` : ""}`);
  const s = store();
  const rows = [...s.audit].reverse().filter((e) => !action || e.action.startsWith(action)).slice(0, 300);
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-2xl font-bold">Audit log</h1>
      <p className="mt-1 text-sm text-muted">Append-only record of sensitive actions: reassignments, contact and owner views, disclosures, overrides, payments, waivers, refunds, credit changes.</p>
      <nav className="mt-4 flex flex-wrap gap-2" aria-label="Filter">
        {GROUPS.map(([v, l]) => <Link key={v} href={v ? `/admin/audit?action=${v}` : "/admin/audit"} className="chip" aria-pressed={action === v}>{l}</Link>)}
      </nav>
      <div className="card mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-line text-muted"><tr><th className="p-3">When</th><th className="p-3">Who</th><th className="p-3">Action</th><th className="p-3">Details</th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((e, i) => (
              <tr key={i} className="align-top">
                <td className="whitespace-nowrap p-3">{formatDateTime(new Date(e.at).toISOString())}</td>
                <td className="p-3">{e.actorId ? s.users.get(e.actorId)?.name ?? e.actorId : "System"}</td>
                <td className="p-3 font-mono text-xs">{e.action}</td>
                <td className="p-3 text-xs text-muted">{e.entityType} {e.entityId.slice(0, 18)}{e.metadata && Object.keys(e.metadata).length ? ` · ${JSON.stringify(e.metadata).slice(0, 160)}` : ""}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="p-3 text-muted">Nothing recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
