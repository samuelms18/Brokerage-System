import Link from "next/link";

const LEAD_LABEL: Record<string, string> = {
  new: "New", contacted: "Contacted", requirement_confirmed: "Requirement confirmed", properties_suggested: "Properties suggested",
  visit_scheduled: "Visit scheduled", visited: "Visited", interested: "Interested", negotiation: "Negotiation", assigned: "Assigned",
  brokerage_pending: "Brokerage pending", brokerage_paid: "Brokerage paid", move_in_complete: "Move-in complete",
  not_interested: "Not interested", lost: "Lost", student_cancelled: "Student cancelled", property_unavailable: "Property unavailable", duplicate: "Duplicate",
};
export const leadLabel = (s: string) => LEAD_LABEL[s] ?? s;

export function Kpi({ label, value, href, tone = "default" }: { label: string; value: string | number; href: string; tone?: "default" | "attention" | "critical" }) {
  const ring = tone === "critical" ? "border-red-200 bg-red-50/50" : tone === "attention" ? "border-amber-200 bg-amber-50/50" : "";
  return (
    <Link href={href} className={`card block p-4 transition-shadow hover:shadow-sm ${ring}`}>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </Link>
  );
}

export function minutesLeft(iso: string | null | undefined) {
  if (!iso) return null;
  return Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 60000));
}

export function Countdown({ iso }: { iso: string | null | undefined }) {
  const m = minutesLeft(iso);
  if (m === null) return null;
  return (
    <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${m <= 10 ? "bg-red-50 text-critical" : "bg-amber-50 text-attention"}`}>
      Respond within {m} min
    </span>
  );
}
