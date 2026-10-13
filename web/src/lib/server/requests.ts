// Student request flow (docs/broker-allocation.md §5). Mirrors the database
// function eligible_brokers() so the prototype behaves like the real system.
// Prototype simplifications: the response window ignores business hours, and
// there is no background sweeper or queue retry.

import type { components } from "@/lib/api-types";
import { audit, newId, store } from "./store";
import { isActiveLead, type Broker, type Lead, type LeadAssignmentEvent, type Property } from "./model";
import { findStudentVisible } from "./listings";
import { toStudentRequest } from "./student-dto";
import { latestDisclosure } from "./brokerage";

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

/** Brokers who already timed out on, declined, or went unavailable for this lead. */
export function excludedBrokers(lead: Lead): string[] {
  return lead.assignments
    .filter((e) => ["response_timeout", "broker_declined", "broker_unavailable"].includes(e.reason) && e.previousBrokerId)
    .map((e) => e.previousBrokerId!);
}

/**
 * Offers the lead to the best eligible broker, or puts it in the Unassigned
 * Queue. `trigger` is why allocation runs: a new request, a queue retry, or
 * the previous broker timing out / declining / becoming unavailable.
 */
export function allocate(lead: Lead, p: Property, now: number, trigger: "new" | LeadAssignmentEvent["reason"] = "new") {
  const s = store();
  const previous = lead.brokerId;
  const excluded = excludedBrokers(lead);
  if (previous && ["response_timeout", "broker_declined", "broker_unavailable"].includes(trigger)) excluded.push(previous);
  const chosen = eligibleBrokers(p, excluded, now)[0];
  for (const f of lead.followUps) if (f.status === "open" || f.status === "snoozed") f.brokerId = chosen?.userId ?? null;
  if (!chosen) {
    lead.allocationStatus = "unassigned";
    lead.brokerId = null;
    lead.responseDueAt = null;
    lead.queuedAt = now;
    lead.assignments.push({ previousBrokerId: previous, newBrokerId: null, method: "automatic", reason: trigger === "new" || trigger === "queue_retry" ? "no_eligible_broker" : trigger, responseDueAt: null, at: now });
    audit(null, "lead.queued", "lead", lead.id, { previous });
    // Real system: notify users with receives_ops_alerts.
    return;
  }
  lead.brokerId = chosen.userId;
  lead.allocationStatus = "offered";
  lead.responseDueAt = now + RESPONSE_WINDOW_MS;
  lead.queuedAt = null;
  s.brokers.get(chosen.userId)!.lastAssignedAt = now;
  const reason: LeadAssignmentEvent["reason"] = trigger !== "new" ? trigger
    : chosen.userId === p.brokerId ? "property_broker" : "authorized_fallback";
  lead.assignments.push({ previousBrokerId: previous, newBrokerId: chosen.userId, method: "automatic", reason, responseDueAt: lead.responseDueAt, at: now });
  if (!lead.followUps.some((f) => f.status === "open")) {
    lead.followUps.push({ id: newId("fu"), action: "Respond to new lead", dueAt: lead.responseDueAt, status: "open", brokerId: chosen.userId });
  }
  audit(null, "lead.offered", "lead", lead.id, { broker: chosen.userId, reason, previous });
  // Real system: push notification to the broker (and to the previous one on reassignment).
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
      followUps: [],
      lostReason: null,
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
  const a = store().assignments.filter((x) => x.leadId === lead.id && x.status !== "cancelled").sort((x, y) => y.createdAt - x.createdAt)[0];
  const d = a ? latestDisclosure(a.id, "student") : undefined;
  if (!d) throw new RequestError("INVALID_STATUS_TRANSITION", "There is no brokerage amount to acknowledge yet.");
  if (d.acknowledgedAt === null) {
    d.acknowledgedAt = Date.now();
    lead.timeline.push({ at: Date.now(), label: "You acknowledged the brokerage amount" });
    audit(studentId, "brokerage.acknowledged", "assignment", a!.id, { amount: d.amount });
  }
  return lead;
}

/** Student accepts the time the broker proposed. */
export function confirmVisit(studentId: string, visitId: string) {
  const s = store();
  const v = s.visits.find((x) => x.id === visitId);
  const lead = v ? getStudentLead(studentId, v.leadId) : undefined;
  if (!v || !lead) throw new RequestError("NOT_FOUND", "Visit not found");
  if (v.status !== "proposed" && v.status !== "rescheduled") throw new RequestError("INVALID_STATUS_TRANSITION", "There is no proposed time to confirm.");
  v.status = "confirmed";
  if (["new", "contacted", "requirement_confirmed", "properties_suggested"].includes(lead.status)) lead.status = "visit_scheduled";
  lead.updatedAt = Date.now();
  lead.timeline.push({ at: Date.now(), label: "You confirmed the visit time" });
  return lead;
}
