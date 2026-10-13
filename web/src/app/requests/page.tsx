import type { Metadata } from "next";
import Link from "next/link";
import { requireStudentPage } from "@/lib/page-auth";
import { listStudentRequests } from "@/lib/server/requests";
import { StatusPill } from "@/components/StatusPill";
import { formatDateTime, inr } from "@/lib/format";

export const metadata: Metadata = { title: "My requests" };

export default async function RequestsPage() {
  const { user, collegeId } = await requireStudentPage("/requests");
  const requests = listStudentRequests(user.id, "all", collegeId);
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-bold">My requests</h1>
      {requests.length === 0 ? (
        <div className="card mt-6 p-8 text-center">
          <p className="font-semibold">No requests yet</p>
          <p className="mt-1 text-sm text-muted">Open a property and tap Request visit. A broker will contact you.</p>
          <Link href="/" className="btn btn-primary mt-4">Browse properties</Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {requests.map((r) => (
            <li key={r.id}>
              <Link href={`/requests/${r.id}`} className="card flex items-center justify-between gap-4 p-4 hover:shadow-sm">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{r.property.title}</p>
                  <p className="text-sm text-muted">{r.type === "visit" ? "Visit request" : "Interest"} · from {inr(r.property.rent_from)}/mo · updated {formatDateTime(r.updated_at)}</p>
                </div>
                <StatusPill status={r.display_status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
