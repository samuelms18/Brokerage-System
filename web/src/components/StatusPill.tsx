import { STATUS_LABEL } from "@/lib/format";

const TONE: Record<string, string> = {
  request_received: "bg-blue-50 text-info",
  broker_contacted: "bg-blue-50 text-info",
  visit_scheduled: "bg-amber-50 text-attention",
  visited: "bg-amber-50 text-attention",
  room_assigned: "bg-green-50 text-success",
  moved_in: "bg-green-50 text-success",
  closed: "bg-gray-100 text-muted",
};

export function StatusPill({ status }: { status: string }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[status] ?? "bg-gray-100"}`}>{STATUS_LABEL[status] ?? status}</span>;
}
