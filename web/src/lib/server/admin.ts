// Super Admin actions (prototype step 3). Where a business rule is still an
// open question, the most restrictive behaviour from docs/decisions.md is
// used and marked with the question ID.

import { audit, newId, store } from "./store";
import { isActiveLead, isUnavailableAt, type BrokeragePolicy, type BrokerageRecord, type CalcType, type Lead, type PropertyType, type Refund } from "./model";
import { allocate, eligibleBrokers, excludedBrokers } from "./requests";
import { retryQueue, setAvailability } from "./broker";
import { activeRooms } from "./student-dto";

export class AdminError extends Error {
  constructor(public code: "NOT_FOUND" | "VALIDATION_FAILED" | "INVALID_STATUS_TRANSITION" | "FORBIDDEN" | "PUBLISH_VALIDATION_FAILED",
              message: string, public errors?: Record<string, string[]>) {
    super(message);
  }
}

const required = (v: string | undefined | null, field: string, min = 3) => {
  if (!v || v.trim().length < min) throw new AdminError("VALIDATION_FAILED", "A reason is required", { [field]: ["Required"] });
  return v.trim();
};

// ------------------------------------------------------------ properties --

/** Approve (publish) or send back to draft (D-06). */
export function verifyProperty(adminId: string, propertyId: string, input: { decision: "publish" | "reject"; note?: string; photosChecked?: boolean }) {
  const s = store();
  const p = s.properties.find((x) => x.id === propertyId);
  if (!p) throw new AdminError("NOT_FOUND", "Property not found");
  if (p.status !== "verification") throw new AdminError("INVALID_STATUS_TRANSITION", "Only properties awaiting verification can be approved or rejected.");
  const user = s.users.get(adminId)!;
  // PV-1 (open): a verifier may not approve a property they manage; Super Admin may approve any.
  if (user.role !== "super_admin" && p.brokerId === adminId) throw new AdminError("FORBIDDEN", "You can't verify a property you manage.");
  if (input.decision === "reject") {
    const note = required(input.note, "note"); // validate before changing anything
    p.status = "draft";
    p.verificationNote = note;
    audit(adminId, "property.rejected", "property", p.id, { note: p.verificationNote });
    return p;
  }
  const missing: string[] = [];
  if (activeRooms(p).length === 0) missing.push("at least one active room");
  if (!p.photos.some((ph) => ph.isPublic)) missing.push("at least one public photo");
  if (!input.photosChecked) missing.push("confirmation that public photos don't show the house number, signboard or owner");
  if (missing.length) throw new AdminError("PUBLISH_VALIDATION_FAILED", `Can't publish yet: needs ${missing.join(", ")}.`);
  const free = activeRooms(p).reduce((n, r) => n + r.beds.filter((b) => b.status === "available").length, 0);
  const occupied = activeRooms(p).some((r) => r.beds.some((b) => b.status === "occupied"));
  p.status = free === 0 ? "fully_occupied" : occupied ? "partially_occupied" : "published";
  p.verifiedAt = Date.now();
  p.verifiedBy = adminId;
  p.verificationNote = undefined;
  p.publishedAt = new Date().toISOString().slice(0, 10);
  audit(adminId, "property.published", "property", p.id);
  return p;
}

// ---------------------------------------------------------------- brokers --

export function brokerOverview() {
  const s = store();
  const now = Date.now();
  return [...s.brokers.values()].map((b) => {
    const user = s.users.get(b.userId)!;
    const mine = s.leads.filter((l) => l.brokerId === b.userId && isActiveLead(l));
    const current = b.unavailable.find((w) => isUnavailableAt(w, now));
    return {
      broker: b, user,
      activeLeads: mine.length,
      offeredLeads: mine.filter((l) => l.allocationStatus === "offered").length,
      currentLeave: current ?? null,
      upcoming: b.unavailable.filter((w) => w.cancelledAt === null && w.startsAt > now),
      eligibleNow: user.status === "active" && b.acceptingLeads && mine.length < b.maxActiveLeads && !current,
    };
  });
}

export function updateBroker(adminId: string, brokerId: string, input: { maxActiveLeads?: number; acceptingLeads?: boolean; canOverrideBrokerage?: boolean }) {
  const s = store();
  const b = s.brokers.get(brokerId);
  const user = s.users.get(brokerId);
  if (!b || !user) throw new AdminError("NOT_FOUND", "Broker not found");
  if (input.maxActiveLeads !== undefined) {
    if (!Number.isInteger(input.maxActiveLeads) || input.maxActiveLeads < 0) throw new AdminError("VALIDATION_FAILED", "Capacity must be a whole number", { max_active_leads: ["Invalid"] });
    b.maxActiveLeads = input.maxActiveLeads;
    audit(adminId, "broker.capacity_changed", "broker", brokerId, { max: b.maxActiveLeads });
  }
  if (input.canOverrideBrokerage !== undefined) {
    user.canOverrideBrokerage = input.canOverrideBrokerage;
    audit(adminId, "user.permissions_changed", "user", brokerId, { can_override_brokerage: input.canOverrideBrokerage });
  }
  if (input.acceptingLeads !== undefined && input.acceptingLeads !== b.acceptingLeads) setAvailability(brokerId, input.acceptingLeads);
  retryQueue();
  return b;
}

/** Leave / unavailable window. If it covers now, offered leads move immediately. */
export function addUnavailability(adminId: string, brokerId: string, input: { kind: "leave" | "unavailable"; startsAt: string; endsAt: string; reason?: string }) {
  const s = store();
  const b = s.brokers.get(brokerId);
  if (!b) throw new AdminError("NOT_FOUND", "Broker not found");
  const startsAt = Date.parse(input.startsAt);
  const endsAt = Date.parse(input.endsAt);
  if (Number.isNaN(startsAt) || Number.isNaN(endsAt) || endsAt <= startsAt) {
    throw new AdminError("VALIDATION_FAILED", "The end must be after the start", { ends_at: ["Must be after the start"] });
  }
  const w = { id: newId("unav"), kind: input.kind, startsAt, endsAt, reason: input.reason?.trim() || null, createdBy: adminId, cancelledAt: null };
  b.unavailable.push(w);
  audit(adminId, "broker.unavailability_added", "broker", brokerId, { kind: w.kind, startsAt: input.startsAt, endsAt: input.endsAt });
  const now = Date.now();
  if (isUnavailableAt(w, now)) {
    for (const lead of s.leads.filter((l) => l.brokerId === brokerId && l.allocationStatus === "offered" && isActiveLead(l))) {
      allocate(lead, s.properties.find((p) => p.id === lead.propertyId)!, now, "broker_unavailable");
    }
  }
  return w;
}

export function cancelUnavailability(adminId: string, unavailabilityId: string) {
  const b = [...store().brokers.values()].find((x) => x.unavailable.some((w) => w.id === unavailabilityId));
  const w = b?.unavailable.find((x) => x.id === unavailabilityId && x.cancelledAt === null);
  if (!b || !w) throw new AdminError("NOT_FOUND", "Leave not found");
  w.cancelledAt = Date.now();
  audit(adminId, "broker.unavailability_cancelled", "broker", b.userId);
  retryQueue();
  return w;
}

// ------------------------------------------------------------- allocation --

export function unassignedQueue(): Lead[] {
  return store().leads.filter((l) => l.allocationStatus === "unassigned" && isActiveLead(l)).sort((a, b) => (a.queuedAt ?? 0) - (b.queuedAt ?? 0));
}

/** Manual reassignment (exceptions only). Works in any state; never moves brokerage credit (D-15). */
export function manualReassign(adminId: string, leadId: string, brokerId: string, note: string) {
  const s = store();
  const lead = s.leads.find((l) => l.id === leadId);
  if (!lead) throw new AdminError("NOT_FOUND", "Lead not found");
  if (!isActiveLead(lead)) throw new AdminError("INVALID_STATUS_TRANSITION", "Closed leads can't be reassigned.");
  const target = s.brokers.get(brokerId);
  if (!target || s.users.get(brokerId)?.status !== "active") throw new AdminError("VALIDATION_FAILED", "Choose an active broker", { broker_id: ["Invalid"] });
  if (brokerId === lead.brokerId) throw new AdminError("VALIDATION_FAILED", "The lead is already with this broker", { broker_id: ["Same broker"] });
  const reason = required(note, "reason_note", 5);
  const now = Date.now();
  const previous = lead.brokerId;
  lead.brokerId = brokerId;
  lead.allocationStatus = "accepted";
  lead.responseDueAt = null;
  lead.queuedAt = null;
  lead.updatedAt = now;
  for (const f of lead.followUps) if (f.status === "open" || f.status === "snoozed") f.brokerId = brokerId;
  if (!lead.followUps.some((f) => f.status === "open")) {
    lead.followUps.push({ id: newId("fu"), action: "Call the student (lead reassigned to you)", dueAt: now + 4 * 3600_000, status: "open", brokerId });
  }
  lead.assignments.push({ previousBrokerId: previous, newBrokerId: brokerId, method: "manual", reason: "manual_reassignment", note: reason, responseDueAt: null, acceptedAt: now, at: now });
  target.lastAssignedAt = now;
  audit(adminId, "lead.reassigned", "lead", lead.id, { from: previous, to: brokerId, reason });
  // Real system: notify the previous and the new broker.
  return lead;
}

export function suggestedBrokers(lead: Lead) {
  const p = store().properties.find((x) => x.id === lead.propertyId)!;
  return eligibleBrokers(p, excludedBrokers(lead)).map((b) => b.userId);
}

// --------------------------------------------------------------- policies --

export interface PolicyInput {
  name: string;
  areaId?: string | null;
  propertyType?: PropertyType | null;
  priority?: number;
  payerMode: "student" | "owner" | "both";
  student?: { calcType: CalcType; value: number } | null;
  owner?: { calcType: CalcType; value: number } | null;
}

function validCalc(c: { calcType: CalcType; value: number } | null | undefined, field: string, errors: Record<string, string[]>) {
  if (!c) { errors[field] = ["Required for this payer"]; return; }
  if (!["flat", "percent_of_monthly_rent", "months_of_rent"].includes(c.calcType)) errors[field] = ["Choose a calculation"];
  else if (!Number.isFinite(c.value) || c.value < 0) errors[field] = ["Enter a valid value"];
  else if (c.calcType === "percent_of_monthly_rent" && c.value > 100) errors[field] = ["Percentage cannot exceed 100"];
  else if (c.calcType === "months_of_rent" && c.value < 1) errors[field] = ["At least 1 month"];
}

/** Policies are never edited: a change creates a new one and deactivates the old (history kept). */
export function createPolicy(adminId: string, input: PolicyInput, replacesPolicyId?: string): BrokeragePolicy {
  const s = store();
  const errors: Record<string, string[]> = {};
  if (!input.name?.trim()) errors.name = ["Required"];
  if (!["student", "owner", "both"].includes(input.payerMode)) errors.payer_mode = ["Choose who pays"];
  const paysStudent = input.payerMode === "student" || input.payerMode === "both";
  const paysOwner = input.payerMode === "owner" || input.payerMode === "both";
  if (paysStudent) validCalc(input.student, "student", errors);
  if (paysOwner) validCalc(input.owner, "owner", errors);
  if (Object.keys(errors).length) throw new AdminError("VALIDATION_FAILED", "Check the policy", errors);
  const replaced = replacesPolicyId ? s.policies.find((p) => p.id === replacesPolicyId && p.isActive) : undefined;
  if (replacesPolicyId && !replaced) throw new AdminError("NOT_FOUND", "Policy to replace not found");
  const policy: BrokeragePolicy = {
    id: newId("pol"), name: input.name.trim(), areaId: input.areaId || null, propertyType: input.propertyType || null,
    priority: Number.isInteger(input.priority) ? input.priority! : 0, payerMode: input.payerMode,
    student: paysStudent ? { calcType: input.student!.calcType, value: input.student!.value } : null,
    owner: paysOwner ? { calcType: input.owner!.calcType, value: input.owner!.value } : null,
    isActive: true, createdAt: Date.now(),
  };
  if (replaced) deactivatePolicy(adminId, replaced.id);
  s.policies.push(policy);
  audit(adminId, "brokerage.policy_created", "brokerage_policy", policy.id, { replaces: replaced?.id, payerMode: policy.payerMode, student: policy.student, owner: policy.owner });
  return policy;
}

export function deactivatePolicy(adminId: string, policyId: string) {
  const p = store().policies.find((x) => x.id === policyId && x.isActive);
  if (!p) throw new AdminError("NOT_FOUND", "Active policy not found");
  p.isActive = false;
  audit(adminId, "brokerage.policy_deactivated", "brokerage_policy", p.id);
  return p;
}

// ---------------------------------------------- waivers, refunds, credit --

function recordOf(id: string): BrokerageRecord {
  const r = store().brokerages.find((b) => b.id === id);
  if (!r) throw new AdminError("NOT_FOUND", "Brokerage not found");
  return r;
}

function settleLead(r: BrokerageRecord) {
  const s = store();
  const a = s.assignments.find((x) => x.id === r.assignmentId)!;
  const lead = s.leads.find((l) => l.id === a.leadId)!;
  const all = s.brokerages.filter((b) => b.assignmentId === a.id);
  if (all.every((b) => ["paid", "waived"].includes(b.status)) && lead.status === "brokerage_pending") lead.status = "brokerage_paid";
}

/** BR-2 (open): Super Admin only; waives the whole outstanding balance. */
export function waive(adminId: string, brokerageId: string, reason: string) {
  const r = recordOf(brokerageId);
  if (!["pending", "partially_paid"].includes(r.status)) throw new AdminError("INVALID_STATUS_TRANSITION", "Only unpaid or part-paid brokerage can be waived.");
  r.waivedReason = required(reason, "reason");
  r.waivedBy = adminId;
  r.status = "waived";
  audit(adminId, "brokerage.waived", "brokerage", r.id, { outstanding: r.amount - r.paidAmount, reason: r.waivedReason });
  settleLead(r);
  return r;
}

const pendingRefunds = (brokerageId: string) => store().refunds.filter((x) => x.brokerageId === brokerageId && x.status === "pending");

/** BR-3 (open): when refunds are due is undecided; Super Admin records them manually. */
export function requestRefund(adminId: string, brokerageId: string, amount: number, reason: string): Refund {
  const r = recordOf(brokerageId);
  const available = r.paidAmount - r.refundedAmount - pendingRefunds(r.id).reduce((n, x) => n + x.amount, 0);
  const why = required(reason, "reason");
  if (!Number.isFinite(amount) || amount <= 0) throw new AdminError("VALIDATION_FAILED", "Enter the refund amount", { amount: ["Required"] });
  if (amount > available) throw new AdminError("VALIDATION_FAILED", `At most ₹${available.toLocaleString("en-IN")} can be refunded.`, { amount: ["Too high"] });
  const refund: Refund = {
    id: newId("ref"), brokerageId: r.id, amount: Math.round(amount * 100) / 100, status: "pending", reason: why,
    method: null, reference: null, requestedBy: adminId, requestedAt: Date.now(), processedBy: null, processedAt: null,
  };
  store().refunds.push(refund);
  r.status = "refund_pending";
  audit(adminId, "brokerage.refund_requested", "brokerage", r.id, { amount: refund.amount, reason: why });
  return refund;
}

function statusAfterRefunds(r: BrokerageRecord) {
  if (pendingRefunds(r.id).length) return "refund_pending" as const;
  if (r.refundedAmount > 0) return "refunded" as const;
  return r.paidAmount >= r.amount ? "paid" as const : r.paidAmount > 0 ? "partially_paid" as const : "pending" as const;
}

export function completeRefund(adminId: string, refundId: string, input: { method: Refund["method"]; reference?: string }) {
  const refund = store().refunds.find((x) => x.id === refundId && x.status === "pending");
  if (!refund) throw new AdminError("NOT_FOUND", "Pending refund not found");
  if (!input.method || !["upi", "cash", "bank_transfer"].includes(input.method)) throw new AdminError("VALIDATION_FAILED", "Choose how it was paid out", { method: ["Required"] });
  if (input.method !== "cash" && !input.reference?.trim()) throw new AdminError("VALIDATION_FAILED", "Enter the UPI / bank reference", { reference: ["Required"] });
  const r = recordOf(refund.brokerageId);
  refund.status = "completed";
  refund.method = input.method;
  refund.reference = input.reference?.trim() || null;
  refund.processedBy = adminId;
  refund.processedAt = Date.now();
  r.refundedAmount = Math.round((r.refundedAmount + refund.amount) * 100) / 100;
  r.status = statusAfterRefunds(r);
  audit(adminId, "brokerage.refund_completed", "brokerage", r.id, { amount: refund.amount, method: refund.method });
  return refund;
}

export function cancelRefund(adminId: string, refundId: string, reason: string) {
  const refund = store().refunds.find((x) => x.id === refundId && x.status === "pending");
  if (!refund) throw new AdminError("NOT_FOUND", "Pending refund not found");
  required(reason, "reason");
  refund.status = "cancelled";
  const r = recordOf(refund.brokerageId);
  r.status = statusAfterRefunds(r);
  audit(adminId, "brokerage.refund_cancelled", "brokerage", r.id, { reason });
  return refund;
}

/** The only way credit changes (D-15). Whole-record credit only: splitting is open (BR-8). */
export function overrideCredit(adminId: string, brokerageId: string, brokerId: string, reason: string) {
  const s = store();
  const r = recordOf(brokerageId);
  if (!s.brokers.has(brokerId)) throw new AdminError("VALIDATION_FAILED", "Choose a broker", { broker_id: ["Invalid"] });
  if (brokerId === r.creditedBrokerId) throw new AdminError("VALIDATION_FAILED", "Already credited to this broker", { broker_id: ["Same broker"] });
  const why = required(reason, "reason");
  r.creditHistory.push({ previousBrokerId: r.creditedBrokerId, newBrokerId: brokerId, reason: why, authorizedBy: adminId, at: Date.now() });
  audit(adminId, "brokerage.credit_changed", "brokerage", r.id, { from: r.creditedBrokerId, to: brokerId, reason: why });
  r.creditedBrokerId = brokerId;
  return r;
}
