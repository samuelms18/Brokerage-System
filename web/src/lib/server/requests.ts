// Student request flow (docs/broker-allocation.md §5). Mirrors the database
// function eligible_brokers() so the prototype behaves like the real system.
// Prototype simplifications: the response window ignores business hours, and
// there is no background sweeper or queue retry.

import type { components } from "@/lib/api-types";
import { newId, store } from "./store";
import { isActiveLead, type Broker, type Lead, type Property } from "./model";
import { findStudentVisible } from "./listings";
import { toStudentRequest } from "./student-dto";

type RequestCreate = components["schemas"]["StudentRequestCreate"];
export type RequestReceived = components["schemas"]["RequestReceived"];

export const RESPONSE_WINDOW_MS = 30 * 60 * 1000;

export class RequestError extends Error {
  constructor(public code: "NOT_FOUND" | "VALIDATION_FAILED" | "INVALID_STATUS_TRANSITION",
              message: string, public errors?: Record<string, string[]>) {
    super(message);
  }
}

const RECEIVED = (id: string): RequestReceived => ({
  request_id: id,
  title: "Request Received",
  message: "Your property request has been received. Our broker will contact you shortly.",
});

function activeLeadCount(brokerId: string): number {
  return store().leads.filter((l) => l.brokerId === brokerId && isActiveLead(l)).length;
}

/** Same rules and order as eligible_brokers() in db/schema.sql. */
export function eligibleBrokers(p: Property, excluded: string[] = [], at = Date.now()): Broker[] {
  const s = store();
  const candidates = [...s.brokers.values()].filter((b) => {
    const user = s.users.get(b.userId);
    if (!user || user.role !== "broker" || user.status !== "active") return false;
    if (!b.acceptingLeads) return false;
    if (activeLeadCount(b.userId) >= b.maxActiveLeads) return false;
    if (excluded.includes(b.userId)) return false;
    if (b.unavailable.some((w) => at >= w.startsAt && at < w.endsAt)) return false;
    return b.userId === p.brokerId || b.propertyIds.includes(p.id) || b.areaIds.includes(p.areaId);
  });
  const tier = (b: Broker) => (b.userId === p.brokerId ? 1 : 2);
  return candidates.sort((a, b) =>
    tier(a) - tier(b)
    || activeLeadCount(a.userId) - activeLeadCount(b.userId)
    || (a.lastAssignedAt ?? -1) - (b.lastAssignedAt ?? -1)
    || a.userId.localeCompare(b.userId));
}

function allocate(lead: Lead, p: Property, now: number) {
  const s = store();
  const chosen = eligibleBrokers(p, [], now)[0];
  if (!chosen) {
    lead.allocationStatus = "unassigned";
    lead.brokerId = null;
    lead.queuedAt = now;
    lead.assignments.push({ previousBrokerId: null, newBrokerId: null, method: "automatic", reason: "no_eligible_broker", responseDueAt: null, at: now });
    // Real system: notify users with receives_ops_alerts.
    return;
  }
  lead.brokerId = chosen.userId;
  lead.allocationStatus = "offered";
  lead.responseDueAt = now + RESPONSE_WINDOW_MS;
  lead.queuedAt = null;
  s.brokers.get(chosen.userId)!.lastAssignedAt = now;
  lead.assignments.push({
    previousBrokerId: null,
    newBrokerId: chosen.userId,
    method: "automatic",
    reason: chosen.userId === p.brokerId ? "property_broker" : "authorized_fallback",
    responseDueAt: lead.responseDueAt,
    at: now,
  });
  // Real system: push notification + follow-up task for the broker.
}

function validate(body: RequestCreate): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  if (body.type !== "visit" && body.type !== "interest") errors.type = ["Choose visit or interest"];
  const today = new Date().toISOString().slice(0, 10);
  if (body.type === "visit") {
    const slots = body.preferred_slots ?? [];
    if (slots.length < 1 || slots.length > 3) errors.preferred_slots = ["Pick 1 to 3 preferred slots"];
    else if (slots.some((sl) => !/^\d{4}-\d{2}-\d{2}$/.test(sl.date) || sl.date < today)) errors.preferred_slots = ["Dates must be today or later"];
  }
  const people = body.people_count ?? 1;
  if (!Number.isInteger(people) || people < 1 || people > 10) errors.people_count = ["Between 1 and 10 people"];
  if ((body.note ?? "").length > 500) errors.note = ["Keep the note under 500 characters"];
  return errors;
}

/**
 * Request Visit / I'm Interested. Reuses the active lead for this student +
 * property (no duplicate, no re-allocation) or creates one and allocates it.
 * The response is identical in every case.
 */
export function createStudentRequest(studentId: string, body: RequestCreate, idempotencyKey?: string | null): RequestReceived {
  const s = store();
  const idemKey = idempotencyKey ? `${studentId}:${idempotencyKey}` : null;
  if (idemKey) {
    const hit = s.idempotency.get(idemKey);
    if (hit && Date.now() - hit.at < 24 * 3600 * 1000) return hit.body as RequestReceived;
  }

  const property = findStudentVisible(String(body.property_code ?? ""));
  if (!property) throw new RequestError("NOT_FOUND", "This property is not available.");
  const errors = validate(body);
  if (Object.keys(errors).length) throw new RequestError("VALIDATION_FAILED", "Check the highlighted fields", errors);

  const now = Date.now();
  let lead = s.leads.find((l) => l.studentId === studentId && l.propertyId === property.id && isActiveLead(l));
  if (lead) {
    lead.updatedAt = now;
    lead.timeline.push({ at: now, label: body.type === "visit" ? "You requested another visit" : "You confirmed your interest again" });
    // Real system: notify the current broker, if any. No re-allocation.
  } else {
    lead = {
      id: newId("lead"),
      code: `LD-${++s.seq.lead}`,
      studentId,
      propertyId: property.id,
      brokerId: null,
      type: body.type,
      source: body.type === "visit" ? "visit_request" : "interest",
      status: "new",
      allocationStatus: "unassigned",
      responseDueAt: null,
      queuedAt: null,
      createdAt: now,
      updatedAt: now,
      timeline: [{ at: now, label: body.type === "visit" ? "Visit requested" : "Interest sent" }],
      assignments: [],
      studentBrokerage: null,
    };
    s.leads.push(lead);
    allocate(lead, property, now);
  }

  if (body.type === "visit") {
    s.visits.push({
      id: newId("visit"),
      leadId: lead.id,
      status: "requested",
      preferredSlots: (body.preferred_slots ?? []).map((sl) => ({ date: sl.date, from: sl.from, to: sl.to })),
      scheduledAt: null,
      peopleCount: body.people_count ?? 1,
      note: body.note?.trim() || null,
      createdAt: now,
    });
  }

  const res = RECEIVED(lead.id);
  if (idemKey) s.idempotency.set(idemKey, { at: now, body: res });
  return res;
}

export function listStudentRequests(studentId: string, state: "open" | "closed" | "all", collegeId?: string | null) {
  return store().leads
    .filter((l) => l.studentId === studentId)
    .filter((l) => state === "all" || (state === "open" ? isActiveLead(l) : !isActiveLead(l)))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((l) => toStudentRequest(l, { studentId, collegeId }));
}

export function getStudentLead(studentId: string, id: string): Lead | undefined {
  // Object-level check: other students' leads look exactly like missing ones.
  return store().leads.find((l) => l.id === id && l.studentId === studentId);
}

export function cancelStudentRequest(studentId: string, id: string) {
  const lead = getStudentLead(studentId, id);
  if (!lead) throw new RequestError("NOT_FOUND", "Request not found");
  if (!isActiveLead(lead) || ["assigned", "brokerage_pending", "brokerage_paid"].includes(lead.status)) {
    throw new RequestError("INVALID_STATUS_TRANSITION", "This request can no longer be withdrawn here. Contact your broker.");
  }
  const now = Date.now();
  lead.status = "student_cancelled";
  lead.updatedAt = now;
  lead.timeline.push({ at: now, label: "You withdrew this request" });
  for (const v of store().visits) if (v.leadId === lead.id && ["requested", "proposed", "confirmed", "rescheduled"].includes(v.status)) v.status = "cancelled";
  return lead;
}

export function acknowledgeBrokerage(studentId: string, id: string) {
  const lead = getStudentLead(studentId, id);
  if (!lead) throw new RequestError("NOT_FOUND", "Request not found");
  if (!lead.studentBrokerage) throw new RequestError("INVALID_STATUS_TRANSITION", "There is no brokerage amount to acknowledge yet.");
  if (lead.studentBrokerage.acknowledgedAt === null) {
    lead.studentBrokerage.acknowledgedAt = Date.now();
    lead.timeline.push({ at: Date.now(), label: "You acknowledged the brokerage amount" });
  }
  return lead;
}
