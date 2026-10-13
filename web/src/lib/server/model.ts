// Internal (server-only) records. These mirror db/schema.sql and contain
// PRIVATE data (owners, exact address, exact coordinates). They must never
// be serialised to a student directly: student responses are built only by
// the mappers in student-dto.ts.

export type PropertyType = "pg" | "hostel" | "flat" | "independent_room" | "shared_house";
export type PropertyStatus =
  | "draft" | "verification" | "published" | "partially_occupied"
  | "fully_occupied" | "unavailable" | "archived";
export type BedStatus = "available" | "reserved" | "occupied" | "maintenance" | "blocked";
export type LeadStatus =
  | "new" | "contacted" | "requirement_confirmed" | "properties_suggested" | "visit_scheduled"
  | "visited" | "interested" | "negotiation" | "assigned" | "brokerage_pending" | "brokerage_paid"
  | "move_in_complete" | "not_interested" | "lost" | "student_cancelled" | "property_unavailable"
  | "duplicate";
export type AllocationStatus = "unassigned" | "offered" | "accepted";
export type VisitStatus =
  | "requested" | "proposed" | "confirmed" | "rescheduled" | "completed" | "cancelled" | "no_show";

export interface Area { id: string; name: string; city: string }
export interface College { id: string; name: string; shortName: string; areaId: string }
export interface Amenity { id: string; name: string; category: string }

export interface User {
  id: string;
  role: "super_admin" | "broker" | "student";
  name: string;
  phone: string;
  status: "active" | "suspended" | "deactivated";
}

export interface Broker {
  userId: string;
  displayName: string;
  businessPhone: string;
  acceptingLeads: boolean;
  maxActiveLeads: number;
  lastAssignedAt: number | null;
  areaIds: string[];
  propertyIds: string[];
  unavailable: { startsAt: number; endsAt: number }[];
}

/** PRIVATE */
export interface Owner { id: string; name: string; phone: string; email: string; address: string }

export interface Bed { id: string; label: string; status: BedStatus; availableFrom: string | null }
export interface Room {
  id: string;
  label: string;
  sharing: number;
  roomType: "ac" | "non_ac";
  attachedBathroom: boolean;
  rentPerBed: number;
  depositPerBed: number;
  maintenancePerBed: number;
  status: "active" | "maintenance" | "blocked";
  beds: Bed[];
}

export interface Photo { hue: number; scene: "room" | "building" | "kitchen" | "common"; caption: string; isPublic: boolean }

export interface Property {
  id: string;
  code: string;
  brokerId: string;
  title: string;
  description: string;
  propertyType: PropertyType;
  genderPolicy: "male" | "female" | "any";
  areaId: string;
  localityLabel: string;
  /** Fixed approximate point, computed once from the exact pin. */
  approxLatitude: number;
  approxLongitude: number;
  maintenanceFee: number | null;
  foodIncluded: boolean;
  houseRules: string;
  availableFrom: string | null;
  status: PropertyStatus;
  publishedAt: string;
  amenityIds: string[];
  collegeDistances: { collegeId: string; km: number }[];
  photos: Photo[];
  rooms: Room[];
  /** PRIVATE: owner link and exact location. */
  private: { ownerId: string; addressLine1: string; landmark: string; pincode: string; latitude: number; longitude: number };
}

export interface Student {
  userId: string;
  collegeId: string | null;
}

export interface Visit {
  id: string;
  leadId: string;
  status: VisitStatus;
  preferredSlots: { date: string; from?: string; to?: string }[];
  scheduledAt: string | null;
  peopleCount: number;
  note: string | null;
  createdAt: number;
}

export interface LeadAssignmentEvent {
  previousBrokerId: string | null;
  newBrokerId: string | null;
  method: "automatic" | "manual";
  reason: "property_broker" | "authorized_fallback" | "no_eligible_broker";
  responseDueAt: number | null;
  at: number;
}

export interface StudentBrokerageState {
  amount: number;
  explanation: string;
  status: "pending" | "partially_paid" | "paid" | "waived" | "cancelled" | "refund_pending" | "refunded";
  paidAmount: number;
  acknowledgedAt: number | null;
}

export interface Lead {
  id: string;
  code: string;
  studentId: string;
  propertyId: string;
  brokerId: string | null;
  type: "visit" | "interest";
  source: "visit_request" | "interest";
  status: LeadStatus;
  allocationStatus: AllocationStatus;
  responseDueAt: number | null;
  queuedAt: number | null;
  createdAt: number;
  updatedAt: number;
  timeline: { at: number; label: string }[];
  assignments: LeadAssignmentEvent[];
  /** Student's own brokerage, once disclosed (prototype simulation). */
  studentBrokerage: StudentBrokerageState | null;
}

export const TERMINAL_LEAD_STATUSES: LeadStatus[] = [
  "move_in_complete", "not_interested", "lost", "student_cancelled", "property_unavailable", "duplicate",
];
export const isActiveLead = (l: Lead) => !TERMINAL_LEAD_STATUSES.includes(l.status);

export const STUDENT_VISIBLE_STATUSES: PropertyStatus[] = ["published", "partially_occupied"];
