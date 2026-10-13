// The ONLY place internal records become student responses. Every object is
// built field by field from an allow-list typed against the OpenAPI
// Student* schemas: no spreading, so a new internal field can never leak.
// See docs/data-model.md §3 and the privacy tests.

import type { components } from "@/lib/api-types";
import { lookups, store } from "./store";
import type { Lead, Property, Visit } from "./model";
import { studentBrokerageView } from "./brokerage";

type S = components["schemas"];
export type StudentListingCard = S["StudentListingCard"];
export type StudentListingDetail = S["StudentListingDetail"];
export type StudentRequest = S["StudentRequest"];
export type StudentVisit = S["StudentVisit"];

export const money = (n: number): string => n.toFixed(2);

const areaLabel = (p: Property) => {
  const a = lookups.areas.find((x) => x.id === p.areaId);
  return a ? `${a.name}, ${a.city}` : "";
};

export function activeRooms(p: Property) {
  return p.rooms.filter((r) => r.status === "active");
}

export function availableBeds(p: Property): number {
  return activeRooms(p).reduce((n, r) => n + r.beds.filter((b) => b.status === "available").length, 0);
}

export function rentRange(p: Property) {
  const rooms = activeRooms(p);
  const rents = rooms.map((r) => r.rentPerBed);
  const deposits = rooms.map((r) => r.depositPerBed);
  return { rentFrom: Math.min(...rents), rentTo: Math.max(...rents), depositFrom: Math.min(...deposits) };
}

/** Public photo URLs only. Private photos (e.g. showing the house number) are never listed. */
function publicPhotos(p: Property) {
  return p.photos
    .map((ph, i) => ({ ph, i }))
    .filter(({ ph }) => ph.isPublic)
    .map(({ ph, i }) => ({ url: `/media/${p.code}/${i}.svg`, caption: ph.caption }));
}

function distanceFor(p: Property, collegeId: string | null | undefined): number | null {
  if (!collegeId) return null;
  return p.collegeDistances.find((d) => d.collegeId === collegeId)?.km ?? null;
}

export function toListingCard(p: Property, ctx: { studentId: string; collegeId?: string | null }): StudentListingCard {
  const { rentFrom, rentTo, depositFrom } = rentRange(p);
  const photos = publicPhotos(p);
  const card: StudentListingCard = {
    code: p.code,
    title: p.title,
    property_type: p.propertyType,
    gender_policy: p.genderPolicy,
    area: areaLabel(p),
    locality_label: p.localityLabel,
    rent_from: money(rentFrom),
    rent_to: money(rentTo),
    deposit_from: money(depositFrom),
    sharing_options: [...new Set(activeRooms(p).map((r) => r.sharing))].sort((a, b) => a - b),
    available_beds: availableBeds(p),
    available_from: p.availableFrom,
    food_included: p.foodIncluded,
    top_amenities: p.amenityIds.slice(0, 5).map((id) => lookups.amenities.find((a) => a.id === id)?.name ?? "").filter(Boolean),
    distance_km: distanceFor(p, ctx.collegeId),
    cover_photo_url: photos[0]?.url ?? null,
    is_shortlisted: store().shortlists.get(ctx.studentId)?.has(p.id) ?? false,
  };
  return card;
}

export function toListingDetail(p: Property, ctx: { studentId: string; collegeId?: string | null; similar: Property[] }): StudentListingDetail {
  const { rentFrom, rentTo, depositFrom } = rentRange(p);
  const beds = availableBeds(p);
  const openLead = store().leads.find((l) => l.studentId === ctx.studentId && l.propertyId === p.id && !isTerminal(l));
  const detail: StudentListingDetail = {
    code: p.code,
    title: p.title,
    description: p.description,
    property_type: p.propertyType,
    gender_policy: p.genderPolicy,
    area: areaLabel(p),
    locality_label: p.localityLabel,
    approx_location: { latitude: p.approxLatitude, longitude: p.approxLongitude, radius_m: 500 },
    rent_from: money(rentFrom),
    rent_to: money(rentTo),
    deposit_from: money(depositFrom),
    maintenance_fee: p.maintenanceFee === null ? null : money(p.maintenanceFee),
    food_included: p.foodIncluded,
    house_rules: p.houseRules,
    available_from: p.availableFrom,
    availability: beds === 0 ? "full" : beds <= 2 ? "limited" : "available",
    photos: publicPhotos(p),
    amenities: p.amenityIds.map((id) => lookups.amenities.find((a) => a.id === id)?.name ?? "").filter(Boolean),
    rooms: activeRooms(p).map((r) => ({
      sharing: r.sharing,
      room_type: r.roomType,
      attached_bathroom: r.attachedBathroom,
      rent_per_bed: money(r.rentPerBed),
      deposit_per_bed: money(r.depositPerBed),
      available_beds: r.beds.filter((b) => b.status === "available").length,
      next_available_from: r.beds.map((b) => b.availableFrom).filter((d): d is string => !!d).sort()[0] ?? null,
    })),
    college_distances: p.collegeDistances.map((d) => ({
      college: lookups.colleges.find((c) => c.id === d.collegeId)?.name ?? "",
      distance_km: d.km,
    })),
    // Never shown on the property page (D-07): broker contact appears in
    // My Requests only after a broker accepts the lead.
    broker_contact: null,
    similar: ctx.similar.map((s) => toListingCard(s, ctx)),
    is_shortlisted: store().shortlists.get(ctx.studentId)?.has(p.id) ?? false,
    my_open_request_id: openLead?.id ?? null,
  };
  return detail;
}

function isTerminal(l: Lead) {
  return ["move_in_complete", "not_interested", "lost", "student_cancelled", "property_unavailable", "duplicate"].includes(l.status);
}

export function toStudentVisit(v: Visit): StudentVisit {
  return {
    id: v.id,
    status: v.status,
    preferred_slots: v.preferredSlots.map((s) => ({ ...s })),
    scheduled_at: v.scheduledAt,
    people_count: v.peopleCount,
    meeting_point: null,
  };
}

/** Simplified status for students (no allocation or reassignment details). */
export function displayStatus(l: Lead): StudentRequest["display_status"] {
  if (isTerminal(l) && l.status !== "move_in_complete") return "closed";
  switch (l.status) {
    case "move_in_complete": return "moved_in";
    case "assigned": case "brokerage_pending": case "brokerage_paid": return "room_assigned";
    case "visited": case "interested": case "negotiation": return "visited";
    case "visit_scheduled": return "visit_scheduled";
    default: return l.allocationStatus === "accepted" ? "broker_contacted" : "request_received";
  }
}

export function toStudentRequest(l: Lead, ctx: { studentId: string; collegeId?: string | null }): StudentRequest {
  const s = store();
  const property = s.properties.find((p) => p.id === l.propertyId)!;
  // D-07: broker contact only after the broker has accepted.
  const broker = l.allocationStatus === "accepted" && l.brokerId ? s.brokers.get(l.brokerId) : undefined;
  const closedReason: StudentRequest["closed_reason"] =
    l.status === "student_cancelled" ? "cancelled_by_you"
      : l.status === "property_unavailable" ? "property_unavailable"
      : isTerminal(l) && l.status !== "move_in_complete" ? "not_proceeding" : null;
  return {
    id: l.id,
    property: toListingCard(property, ctx),
    type: l.type,
    display_status: displayStatus(l),
    closed_reason: closedReason,
    visits: s.visits.filter((v) => v.leadId === l.id).sort((a, b) => a.createdAt - b.createdAt).map(toStudentVisit),
    broker_contact: broker
      ? {
          display_name: broker.displayName,
          business_phone: broker.businessPhone,
          whatsapp_url: `https://wa.me/${broker.businessPhone.replace(/\D/g, "")}`,
        }
      : null,
    // Student's own brokerage only; never the owner's.
    brokerage: (() => {
      const b = studentBrokerageView(l.id);
      return b ? { amount: money(b.amount), explanation: b.explanation, status: b.status, paid_amount: money(b.paidAmount), acknowledged: b.acknowledged } : null;
    })(),
    timeline: l.timeline.map((t) => ({ at: new Date(t.at).toISOString(), label: t.label })),
    created_at: new Date(l.createdAt).toISOString(),
    updated_at: new Date(l.updatedAt).toISOString(),
  };
}
