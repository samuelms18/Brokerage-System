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
  /** Extra permissions beyond the role (Super Admin has all). */
  canOverrideBrokerage?: boolean;
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
  reason:
    | "property_broker" | "authorized_fallback" | "queue_retry" | "no_eligible_broker"
    | "broker_unavailable" | "response_timeout" | "broker_declined" | "manual_reassignment";
  note?: string;
  responseDueAt: number | null;
  acceptedAt?: number;
  at: number;
}

export interface FollowUp {
  id: string;
  action: string;
  dueAt: number;
  status: "open" | "done" | "snoozed" | "cancelled";
  brokerId: string | null;
}

export type Party = "student" | "owner";
export type CalcType = "flat" | "percent_of_monthly_rent" | "months_of_rent";

export interface Assignment {
  id: string;
  code: string;
  leadId: string;
  studentId: string;
  propertyId: string;
  roomId: string;
  bedId: string;
  brokerId: string;
  status: "draft" | "pending_confirmation" | "reserved" | "confirmed" | "cancelled" | "completed";
  rentSnapshot: number;
  depositSnapshot: number;
  moveInDate: string | null;
  createdAt: number;
  confirmedAt: number | null;
  cancelReason: string | null;
}

export interface BrokeragePolicy {
  id: string;
  name: string;
  areaId: string | null;
  propertyType: PropertyType | null;
  priority: number;
  payerMode: "student" | "owner" | "both";
  student: { calcType: CalcType; value: number } | null;
  owner: { calcType: CalcType; value: number } | null;
  isActive: boolean;
  createdAt: number;
}

export interface BrokerageOverride {
  id: string;
  level: "property" | "assignment";
  propertyId: string | null;
  assignmentId: string | null;
  party: Party;
  calcType: CalcType | "not_charged";
  value: number | null;
  reason: string;
  createdBy: string;
  createdAt: number;
  revokedAt: number | null;
  revokedBy: string | null;
  revokeReason: string | null;
}

export interface BrokerageDisclosure {
  id: string;
  assignmentId: string;
  party: Party;
  amount: number;
  explanation: string;
  method: "in_app" | "whatsapp" | "phone" | "in_person" | "email";
  disclosedBy: string;
  disclosedAt: number;
  acknowledgedAt: number | null;
}

export type BrokerageStatus = "pending" | "partially_paid" | "paid" | "waived" | "cancelled" | "refund_pending" | "refunded";

export interface BrokerageRecord {
  id: string;
  assignmentId: string;
  party: Party;
  source: "policy" | "property_override" | "assignment_override";
  calcSnapshot: { calcType: CalcType; value: number; rentBase: number; explanation: string };
  amount: number;
  paidAmount: number;
  status: BrokerageStatus;
  creditedBrokerId: string;
  creditHistory: { previousBrokerId: string | null; newBrokerId: string; reason: string; authorizedBy: string | null; at: number }[];
  createdAt: number;
}

export interface Payment {
  id: string;
  brokerageId: string;
  amount: number;
  method: "upi" | "cash" | "bank_transfer";
  reference: string | null;
  receivedAt: string;
  receiptNumber: string;
  recordedBy: string;
  createdAt: number;
}

export interface AuditEntry { at: number; actorId: string | null; action: string; entityType: string; entityId: string; metadata?: Record<string, unknown> }

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
  followUps: FollowUp[];
  lostReason: string | null;
}

export const TERMINAL_LEAD_STATUSES: LeadStatus[] = [
  "move_in_complete", "not_interested", "lost", "student_cancelled", "property_unavailable", "duplicate",
];
export const isActiveLead = (l: Lead) => !TERMINAL_LEAD_STATUSES.includes(l.status);

export const STUDENT_VISIBLE_STATUSES: PropertyStatus[] = ["published", "partially_occupied"];
