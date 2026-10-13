// Broker-side actions (prototype step 2). Object access: a broker acts only
// on leads currently assigned to them; anything else is NOT_FOUND, so the
// existence of other records is not revealed.
// Prototype simplifications: the response-timeout sweep and queue retry run
// on each broker/student read instead of a background job, and the response
// clock ignores business hours.

import { audit, newId, store } from "./store";
import { isActiveLead, type Assignment, type Lead, type LeadStatus, type Property, type Visit } from "./model";
import { allocate, eligibleBrokers, excludedBrokers } from "./requests";
import { BrokerageError, createBrokerageRecords, recordPayment, recordsFor } from "./brokerage";
import { activeRooms } from "./student-dto";

export class BrokerError extends Error {
  constructor(public code: "NOT_FOUND" | "VALIDATION_FAILED" | "INVALID_STATUS_TRANSITION" | "LEAD_NOT_OFFERED_TO_YOU" | "BED_NOT_AVAILABLE" | "DUPLICATE_ACTIVE_LEAD",
              message: string, public errors?: Record<string, string[]>) {
    super(message);
  }
}

const propertyOf = (lead: { propertyId: string }): Property => store().properties.find((p) => p.id === lead.propertyId)!;

/** Expire missed offers and retry the Unassigned Queue (stands in for background jobs). */
export function sweep(now = Date.now()) {
  const s = store();
  for (const lead of s.leads) {
    if (lead.allocationStatus === "offered" && lead.responseDueAt !== null && lead.responseDueAt < now && isActiveLead(lead)) {
      allocate(lead, propertyOf(lead), now, "response_timeout");
    }
  }
  retryQueue(now);
}

export function retryQueue(now = Date.now()) {
  const queued = store().leads.filter((l) => l.allocationStatus === "unassigned" && isActiveLead(l)).sort((a, b) => (a.queuedAt ?? 0) - (b.queuedAt ?? 0));
  for (const lead of queued) {
    if (eligibleBrokers(propertyOf(lead), excludedBrokers(lead), now).length) allocate(lead, propertyOf(lead), now, "queue_retry");
  }
}

export function brokerLead(brokerId: string, leadId: string): Lead {
  const lead = store().leads.find((l) => l.id === leadId && l.brokerId === brokerId);
  if (!lead) throw new BrokerError("NOT_FOUND", "Lead not found");
  return lead;
}

function ensureAccepted(lead: Lead, brokerId: string) {
  if (lead.allocationStatus === "offered") accept(brokerId, lead.id);
}

export function accept(brokerId: string, leadId: string): Lead {
  const lead = store().leads.find((l) => l.id === leadId);
  if (!lead || lead.brokerId !== brokerId || lead.allocationStatus !== "offered") {
    throw new BrokerError("LEAD_NOT_OFFERED_TO_YOU", "This lead is no longer offered to you. It may have been reassigned after the response window.");
  }
  const now = Date.now();
  lead.allocationStatus = "accepted";
  lead.responseDueAt = null;
  lead.updatedAt = now;
  const ev = lead.assignments[lead.assignments.length - 1];
  if (ev) ev.acceptedAt = now;
  for (const f of lead.followUps) if (f.status === "open" && f.action === "Respond to new lead") f.status = "done";
  lead.followUps.push({ id: newId("fu"), action: "Call the student to confirm requirements", dueAt: now + 4 * 3600_000, status: "open", brokerId });
  lead.timeline.push({ at: now, label: "A broker is handling your request" });
  audit(brokerId, "lead.accepted", "lead", lead.id);
  return lead;
}

export function decline(brokerId: string, leadId: string, reason: string) {
  const lead = store().leads.find((l) => l.id === leadId);
  if (!lead || lead.brokerId !== brokerId || lead.allocationStatus !== "offered") {
    throw new BrokerError("LEAD_NOT_OFFERED_TO_YOU", "This lead is no longer offered to you.");
  }
  if (!reason?.trim()) throw new BrokerError("VALIDATION_FAILED", "Give a reason for declining", { reason: ["Required"] });
  lead.assignments[lead.assignments.length - 1].note = reason.trim();
  audit(brokerId, "lead.declined", "lead", lead.id, { reason });
  allocate(lead, propertyOf(lead), Date.now(), "broker_declined");
}

/** Turning availability off moves offered (not accepted) leads to other brokers. */
export function setAvailability(brokerId: string, accepting: boolean) {
  const s = store();
  const b = s.brokers.get(brokerId)!;
  b.acceptingLeads = accepting;
  audit(brokerId, "broker.availability_changed", "broker", brokerId, { accepting });
  const now = Date.now();
  if (!accepting) {
    for (const lead of s.leads.filter((l) => l.brokerId === brokerId && l.allocationStatus === "offered" && isActiveLead(l))) {
      allocate(lead, propertyOf(lead), now, "broker_unavailable");
    }
  } else {
    retryQueue(now);
  }
  return b;
}

const MANUAL_TARGETS: LeadStatus[] = ["contacted", "requirement_confirmed", "properties_suggested", "interested", "negotiation", "not_interested", "lost", "duplicate"];
const TERMINAL_MANUAL: LeadStatus[] = ["not_interested", "lost", "duplicate"];

export function changeStatus(brokerId: string, leadId: string, input: { to: LeadStatus; reason?: string; nextAction?: { action: string; dueAt: string } }) {
  const lead = brokerLead(brokerId, leadId);
  ensureAccepted(lead, brokerId);
  if (!isActiveLead(lead)) throw new BrokerError("INVALID_STATUS_TRANSITION", "This lead is closed.");
  if (!MANUAL_TARGETS.includes(input.to)) {
    throw new BrokerError("INVALID_STATUS_TRANSITION", "That status is set automatically by visits and assignments.");
  }
  const now = Date.now();
  if (TERMINAL_MANUAL.includes(input.to)) {
    if (!input.reason?.trim()) throw new BrokerError("VALIDATION_FAILED", "Give a reason for closing the lead", { reason: ["Required"] });
    lead.lostReason = input.reason.trim();
    for (const f of lead.followUps) if (f.status === "open" || f.status === "snoozed") f.status = "cancelled";
    lead.timeline.push({ at: now, label: "This request was closed" });
  } else {
    // Every open lead keeps a next action (requirements §6).
    const due = input.nextAction ? Date.parse(input.nextAction.dueAt) : NaN;
    if (!input.nextAction?.action?.trim() || Number.isNaN(due)) {
      throw new BrokerError("VALIDATION_FAILED", "Add the next action and when it is due", { next_action: ["Required"] });
    }
    for (const f of lead.followUps) if (f.status === "open") f.status = "done";
    lead.followUps.push({ id: newId("fu"), action: input.nextAction.action.trim(), dueAt: due, status: "open", brokerId });
  }
  audit(brokerId, "lead.status_changed", "lead", lead.id, { from: lead.status, to: input.to, reason: input.reason });
  lead.status = input.to;
  lead.updatedAt = now;
  return lead;
}

export function completeFollowUp(brokerId: string, leadId: string, followUpId: string, next?: { action: string; dueAt: string }) {
  const lead = brokerLead(brokerId, leadId);
  const f = lead.followUps.find((x) => x.id === followUpId && x.status === "open");
  if (!f) throw new BrokerError("NOT_FOUND", "Follow-up not found");
  const othersOpen = lead.followUps.filter((x) => x.status === "open" && x.id !== f.id).length;
  if (isActiveLead(lead) && othersOpen === 0) {
    const due = next ? Date.parse(next.dueAt) : NaN;
    if (!next?.action?.trim() || Number.isNaN(due)) throw new BrokerError("VALIDATION_FAILED", "Add the next action before completing the last one", { next_action: ["Required"] });
    lead.followUps.push({ id: newId("fu"), action: next.action.trim(), dueAt: due, status: "open", brokerId });
  }
  f.status = "done";
  return lead;
}

// ------------------------------------------------------------------ visits --

function brokerVisit(brokerId: string, visitId: string): { v: Visit; lead: Lead } {
  const v = store().visits.find((x) => x.id === visitId);
  if (!v) throw new BrokerError("NOT_FOUND", "Visit not found");
  return { v, lead: brokerLead(brokerId, v.leadId) };
}

export function proposeVisit(brokerId: string, visitId: string, scheduledAt: string) {
  const { v, lead } = brokerVisit(brokerId, visitId);
  ensureAccepted(lead, brokerId);
  if (!["requested", "proposed", "confirmed", "rescheduled"].includes(v.status)) throw new BrokerError("INVALID_STATUS_TRANSITION", "This visit is closed.");
  const at = Date.parse(scheduledAt);
  if (Number.isNaN(at) || at < Date.now() - 60_000) throw new BrokerError("VALIDATION_FAILED", "Pick a time in the future", { scheduled_at: ["Must be in the future"] });
  v.status = v.status === "confirmed" ? "rescheduled" : "proposed";
  v.scheduledAt = new Date(at).toISOString();
  lead.updatedAt = Date.now();
  lead.timeline.push({ at: Date.now(), label: v.status === "rescheduled" ? "Your broker proposed a new visit time" : "Your broker proposed a visit time" });
  audit(brokerId, "visit.proposed", "visit", v.id, { scheduledAt: v.scheduledAt });
  return v;
}

/** Broker schedules a visit directly (e.g. for an interest-only lead). */
export function scheduleVisit(brokerId: string, leadId: string, scheduledAt: string) {
  const lead = brokerLead(brokerId, leadId);
  const v: Visit = { id: newId("visit"), leadId: lead.id, status: "requested", preferredSlots: [], scheduledAt: null, peopleCount: 1, note: null, createdAt: Date.now() };
  store().visits.push(v);
  return proposeVisit(brokerId, v.id, scheduledAt);
}

export function recordVisitOutcome(brokerId: string, visitId: string, input: { status: "completed" | "no_show" | "cancelled"; outcome?: string; note?: string }) {
  const { v, lead } = brokerVisit(brokerId, visitId);
  if (!["proposed", "confirmed", "rescheduled", "requested"].includes(v.status)) throw new BrokerError("INVALID_STATUS_TRANSITION", "This visit is already closed.");
  if (input.status === "completed") {
    if (!["interested", "not_interested", "wants_more_options", "negotiating"].includes(input.outcome ?? "")) {
      throw new BrokerError("VALIDATION_FAILED", "Record how the visit went", { outcome: ["Required"] });
    }
    lead.status = input.outcome === "interested" ? "interested" : input.outcome === "negotiating" ? "negotiation" : "visited";
    lead.timeline.push({ at: Date.now(), label: "Visit completed" });
  } else {
    lead.timeline.push({ at: Date.now(), label: input.status === "no_show" ? "Visit marked as missed" : "Visit cancelled" });
  }
  v.status = input.status;
  lead.updatedAt = Date.now();
  audit(brokerId, "visit.outcome", "visit", v.id, { status: input.status, outcome: input.outcome });
  return v;
}

// ------------------------------------------------------------- assignments --

export function bedsForLead(brokerId: string, leadId: string) {
  const lead = brokerLead(brokerId, leadId);
  const p = propertyOf(lead);
  return activeRooms(p).flatMap((r) => r.beds.map((b) => ({ room: r, bed: b })));
}

export function brokerAssignment(brokerId: string, id: string): { a: Assignment; lead: Lead } {
  const a = store().assignments.find((x) => x.id === id);
  if (!a) throw new BrokerError("NOT_FOUND", "Assignment not found");
  return { a, lead: brokerLead(brokerId, a.leadId) };
}

export function createAssignment(brokerId: string, leadId: string, bedId: string, moveInDate?: string) {
  const s = store();
  const lead = brokerLead(brokerId, leadId);
  ensureAccepted(lead, brokerId);
  if (s.assignments.some((x) => x.leadId === lead.id && !["cancelled"].includes(x.status))) {
    throw new BrokerError("INVALID_STATUS_TRANSITION", "This lead already has an assignment in progress.");
  }
  const p = propertyOf(lead);
  const room = activeRooms(p).find((r) => r.beds.some((b) => b.id === bedId));
  const bed = room?.beds.find((b) => b.id === bedId);
  // Stands in for the row lock + unique index assignments_one_live_per_bed.
  if (!room || !bed || bed.status !== "available") throw new BrokerError("BED_NOT_AVAILABLE", "That bed is no longer available. Pick another one.");
  bed.status = "reserved";
  const a: Assignment = {
    id: newId("asg"), code: `AS-${++s.seq.assignment}`, leadId: lead.id, studentId: lead.studentId, propertyId: p.id,
    roomId: room.id, bedId: bed.id, brokerId, status: "pending_confirmation",
    rentSnapshot: room.rentPerBed, depositSnapshot: room.depositPerBed,
    moveInDate: moveInDate && /^\d{4}-\d{2}-\d{2}$/.test(moveInDate) ? moveInDate : null,
    createdAt: Date.now(), confirmedAt: null, cancelReason: null,
  };
  s.assignments.push(a);
  if (!["negotiation"].includes(lead.status)) lead.status = "negotiation";
  lead.updatedAt = Date.now();
  audit(brokerId, "assignment.created", "assignment", a.id, { bed: bed.id });
  return a;
}

export function confirmAssignment(brokerId: string, id: string) {
  const { a, lead } = brokerAssignment(brokerId, id);
  if (a.status !== "pending_confirmation" && a.status !== "reserved" && a.status !== "draft") {
    throw new BrokerError("INVALID_STATUS_TRANSITION", "This assignment cannot be confirmed.");
  }
  // Credit: the broker responsible for the assignment at confirmation (D-15).
  createBrokerageRecords(a, brokerId, brokerId); // throws BROKERAGE_NOT_DISCLOSED
  const now = Date.now();
  a.status = "confirmed";
  a.confirmedAt = now;
  a.brokerId = brokerId;
  const p = propertyOf(a);
  for (const r of p.rooms) for (const b of r.beds) if (b.id === a.bedId) b.status = "occupied";
  const free = activeRooms(p).reduce((n, r) => n + r.beds.filter((b) => b.status === "available").length, 0);
  p.status = free === 0 ? "fully_occupied" : "partially_occupied";
  const charged = recordsFor(a.id).length > 0;
  lead.status = charged ? "brokerage_pending" : "assigned";
  lead.updatedAt = now;
  lead.timeline.push({ at: now, label: "Your room is confirmed" });
  audit(brokerId, "assignment.confirmed", "assignment", a.id);
  return a;
}

export function cancelAssignment(brokerId: string, id: string, reason: string) {
  const { a, lead } = brokerAssignment(brokerId, id);
  if (!reason?.trim()) throw new BrokerError("VALIDATION_FAILED", "Give a reason", { reason: ["Required"] });
  if (!["draft", "pending_confirmation", "reserved"].includes(a.status)) {
    throw new BrokerError("INVALID_STATUS_TRANSITION", "Confirmed assignments are cancelled by Super Admin (refund rules are open question BR-3).");
  }
  a.status = "cancelled";
  a.cancelReason = reason.trim();
  for (const r of propertyOf(a).rooms) for (const b of r.beds) if (b.id === a.bedId) b.status = "available";
  lead.updatedAt = Date.now();
  audit(brokerId, "assignment.cancelled", "assignment", a.id, { reason });
  return a;
}

export function brokerBrokerages(brokerId: string) {
  return store().brokerages.filter((b) => b.creditedBrokerId === brokerId).sort((x, y) => y.createdAt - x.createdAt);
}

export function recordPaymentFor(brokerId: string, brokerageId: string, input: Parameters<typeof recordPayment>[2]) {
  const s = store();
  const r = s.brokerages.find((b) => b.id === brokerageId && b.creditedBrokerId === brokerId);
  if (!r) throw new BrokerageError("NOT_FOUND", "Brokerage not found");
  const p = recordPayment(r, brokerId, input);
  const a = s.assignments.find((x) => x.id === r.assignmentId)!;
  const lead = s.leads.find((l) => l.id === a.leadId)!;
  if (r.party === "student") lead.timeline.push({ at: Date.now(), label: `Payment of ₹${p.amount.toLocaleString("en-IN")} recorded (receipt ${p.receiptNumber})` });
  if (recordsFor(a.id).every((x) => x.status === "paid" || x.status === "waived")) lead.status = "brokerage_paid";
  lead.updatedAt = Date.now();
  return p;
}

export function dashboard(brokerId: string) {
  const s = store();
  const mine = s.leads.filter((l) => l.brokerId === brokerId && isActiveLead(l));
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = startOfDay.getTime() + 86_400_000;
  const myVisits = s.visits.filter((v) => mine.some((l) => l.id === v.leadId));
  const followUps = mine.flatMap((l) => l.followUps.filter((f) => f.status === "open"));
  const b = s.brokers.get(brokerId)!;
  return {
    offered: mine.filter((l) => l.allocationStatus === "offered"),
    counts: {
      offered_awaiting_acceptance: mine.filter((l) => l.allocationStatus === "offered").length,
      new_leads: mine.filter((l) => l.status === "new" && l.allocationStatus === "accepted").length,
      visits_today: myVisits.filter((v) => v.scheduledAt && Date.parse(v.scheduledAt) >= startOfDay.getTime() && Date.parse(v.scheduledAt) < endOfDay && ["proposed", "confirmed", "rescheduled"].includes(v.status)).length,
      follow_ups_due: followUps.filter((f) => f.dueAt < endOfDay).length,
      follow_ups_overdue: followUps.filter((f) => f.dueAt < Date.now()).length,
      assignments_pending: s.assignments.filter((a) => mine.some((l) => l.id === a.leadId) && ["pending_confirmation", "reserved"].includes(a.status)).length,
      brokerage_pending_amount: s.brokerages.filter((r) => r.creditedBrokerId === brokerId && ["pending", "partially_paid"].includes(r.status)).reduce((n, r) => n + r.amount - r.paidAmount, 0),
      accepting_leads: b.acceptingLeads,
      active_leads: mine.length,
      max_active_leads: b.maxActiveLeads,
    },
  };
}
