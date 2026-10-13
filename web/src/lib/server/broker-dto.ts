// Broker-facing views, typed against the contract. The student's phone and
// email are included ONLY after the broker has accepted the lead (D-14);
// every reveal is audited.

import type { components } from "@/lib/api-types";
import { audit, lookups, store } from "./store";
import type { Lead, Property, Visit } from "./model";
import { money } from "./student-dto";

type S = components["schemas"];

export function toPropertySummary(p: Property): S["PropertySummary"] {
  const beds = p.rooms.filter((r) => r.status === "active").flatMap((r) => r.beds);
  const area = lookups.areas.find((a) => a.id === p.areaId);
  return {
    id: p.id, code: p.code, title: p.title, area: area ? `${area.name}, ${area.city}` : "", status: p.status,
    broker_id: p.brokerId, rent_from: money(Math.min(...p.rooms.map((r) => r.rentPerBed))),
    beds_total: beds.length,
    beds_available: beds.filter((b) => b.status === "available").length,
    beds_reserved: beds.filter((b) => b.status === "reserved").length,
    beds_occupied: beds.filter((b) => b.status === "occupied").length,
    has_private_details: true,
  };
}

function nextFollowUp(l: Lead): S["FollowUp"] | null {
  const f = l.followUps.filter((x) => x.status === "open").sort((a, b) => a.dueAt - b.dueAt)[0];
  return f ? { id: f.id, lead_id: l.id, action: f.action, due_at: new Date(f.dueAt).toISOString(), status: f.status, snooze_reason: null, completed_at: null } : null;
}

export function toLeadSummary(l: Lead): S["LeadSummary"] {
  const s = store();
  const student = s.users.get(l.studentId)!;
  const collegeId = s.students.get(l.studentId)?.collegeId;
  const p = s.properties.find((x) => x.id === l.propertyId)!;
  return {
    id: l.id, code: l.code, status: l.status, allocation_status: l.allocationStatus,
    response_due_at: l.responseDueAt ? new Date(l.responseDueAt).toISOString() : null,
    student_name: student.name,
    college: lookups.colleges.find((c) => c.id === collegeId)?.name ?? null,
    property: toPropertySummary(p),
    broker_id: l.brokerId,
    next_follow_up: nextFollowUp(l),
    source: l.source,
    created_at: new Date(l.createdAt).toISOString(),
  };
}

export function toBrokerVisit(v: Visit, l: Lead): S["Visit"] {
  const s = store();
  return {
    id: v.id, lead_id: l.id, property: toPropertySummary(s.properties.find((p) => p.id === l.propertyId)!),
    student_name: s.users.get(l.studentId)!.name, status: v.status,
    preferred_slots: v.preferredSlots.map((x) => ({ ...x })), scheduled_at: v.scheduledAt, people_count: v.peopleCount,
    student_note: v.note, outcome: null, outcome_note: null,
  };
}

export function toLeadDetail(l: Lead, viewerId: string): S["LeadDetail"] {
  const s = store();
  const student = s.users.get(l.studentId)!;
  const accepted = l.allocationStatus === "accepted" && l.brokerId === viewerId;
  if (accepted) audit(viewerId, "lead.contact_viewed", "lead", l.id);
  return {
    ...toLeadSummary(l),
    student: {
      id: student.id,
      name: student.name,
      phone: accepted ? student.phone : null,
      email: null,
      college: toLeadSummary(l).college,
      course: null,
      year_of_study: null,
    },
    requirements: {},
    visits: s.visits.filter((v) => v.leadId === l.id).sort((a, b) => a.createdAt - b.createdAt).map((v) => toBrokerVisit(v, l)),
    follow_ups: l.followUps.map((f) => ({ id: f.id, lead_id: l.id, action: f.action, due_at: new Date(f.dueAt).toISOString(), status: f.status, snooze_reason: null, completed_at: null })),
    assignments: [],
    status_history: [],
  };
}
