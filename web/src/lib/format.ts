export const sentence = (s: string | null | undefined) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") : "");

export const inr = (amount: string | number) =>
  `₹${Number(amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export const PROPERTY_TYPE_LABEL: Record<string, string> = {
  pg: "PG", hostel: "Hostel", flat: "Shared flat", independent_room: "Independent room", shared_house: "Shared house",
};

export const GENDER_LABEL: Record<string, string> = { male: "Boys", female: "Girls", any: "Co-living" };

export const sharingLabel = (n: number) => (n === 1 ? "Single" : `${n}-sharing`);

export const STATUS_LABEL: Record<string, string> = {
  request_received: "Request received",
  broker_contacted: "Broker contacted",
  visit_scheduled: "Visit scheduled",
  visited: "Visited",
  room_assigned: "Room assigned",
  moved_in: "Moved in",
  closed: "Closed",
};

export function formatDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  if (!iso) return "";
  return new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("en-IN", opts);
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}
