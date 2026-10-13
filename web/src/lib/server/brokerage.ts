// Brokerage (docs/brokerage.md). quote() mirrors brokerage_quote() in
// db/schema.sql: per party, assignment override → property override →
// best matching active policy (priority, then specificity, then newest).

import { audit, newId, store } from "./store";
import type {
  Assignment, BrokerageDisclosure, BrokerageOverride, BrokeragePolicy, BrokerageRecord, BrokerageStatus, CalcType, Party, Payment,
} from "./model";

export class BrokerageError extends Error {
  constructor(public code: "NOT_FOUND" | "VALIDATION_FAILED" | "FORBIDDEN" | "INVALID_STATUS_TRANSITION" | "BROKERAGE_NOT_DISCLOSED" | "OVERPAYMENT",
              message: string, public errors?: Record<string, string[]>) {
    super(message);
  }
}

export interface QuoteLine {
  party: Party;
  source: "policy" | "property_override" | "assignment_override";
  policyId: string | null;
  overrideId: string | null;
  calcType: CalcType;
  value: number;
  rentBase: number;
  amount: number;
  explanation: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const rupees = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function explain(calcType: CalcType, value: number, rentBase: number): string {
  switch (calcType) {
    case "flat": return `Fixed amount`;
    case "percent_of_monthly_rent": return `${value}% of one month's rent (${rupees(rentBase)})`;
    case "months_of_rent": return `${value} month${value === 1 ? "" : "s"} of rent (${rupees(rentBase)}/month)`;
  }
}

function amountFor(calcType: CalcType, value: number, rentBase: number) {
  if (calcType === "flat") return round2(value);
  if (calcType === "percent_of_monthly_rent") return round2((rentBase * value) / 100);
  return round2(rentBase * value);
}

function bestPolicy(a: Assignment): BrokeragePolicy | undefined {
  const s = store();
  const p = s.properties.find((x) => x.id === a.propertyId)!;
  const specificity = (x: BrokeragePolicy) => Number(x.areaId !== null) + Number(x.propertyType !== null);
  return s.policies
    .filter((x) => x.isActive && (x.areaId === null || x.areaId === p.areaId) && (x.propertyType === null || x.propertyType === p.propertyType))
    .sort((x, y) => y.priority - x.priority || specificity(y) - specificity(x) || y.createdAt - x.createdAt)[0];
}

const activeOverride = (level: "property" | "assignment", id: string, party: Party) =>
  store().overrides.find((o) => o.level === level && o.revokedAt === null && o.party === party
    && (level === "property" ? o.propertyId === id : o.assignmentId === id));

export function quote(a: Assignment): QuoteLine[] {
  const policy = bestPolicy(a);
  const lines: QuoteLine[] = [];
  for (const party of ["student", "owner"] as const) {
    const ao = activeOverride("assignment", a.id, party);
    const po = activeOverride("property", a.propertyId, party);
    const o = ao ?? po;
    let calcType: CalcType | "not_charged" | undefined;
    let value: number | null | undefined;
    if (o) { calcType = o.calcType; value = o.value; }
    else if (policy?.[party]) { calcType = policy[party]!.calcType; value = policy[party]!.value; }
    if (!calcType || calcType === "not_charged" || value === null || value === undefined) continue;
    lines.push({
      party,
      source: ao ? "assignment_override" : po ? "property_override" : "policy",
      policyId: o ? null : policy!.id,
      overrideId: o?.id ?? null,
      calcType,
      value,
      rentBase: a.rentSnapshot,
      amount: amountFor(calcType, value, a.rentSnapshot),
      explanation: explain(calcType, value, a.rentSnapshot),
    });
  }
  return lines;
}

export function latestDisclosure(assignmentId: string, party: Party): BrokerageDisclosure | undefined {
  return store().disclosures.filter((d) => d.assignmentId === assignmentId && d.party === party).sort((x, y) => y.disclosedAt - x.disclosedAt)[0];
}

/** Every charged party has a disclosure for the CURRENT amount. */
export function readyToConfirm(a: Assignment): { ready: boolean; missing: Party[] } {
  const missing = quote(a).filter((l) => latestDisclosure(a.id, l.party)?.amount !== l.amount).map((l) => l.party);
  return { ready: missing.length === 0, missing };
}

export function disclose(a: Assignment, party: Party, method: BrokerageDisclosure["method"], actorId: string): BrokerageDisclosure {
  if (a.status === "confirmed" || a.status === "completed" || a.status === "cancelled") {
    throw new BrokerageError("INVALID_STATUS_TRANSITION", "Brokerage can only be shown before confirmation.");
  }
  if (method === "in_app" && party !== "student") throw new BrokerageError("VALIDATION_FAILED", "In-app disclosure is for the student only.");
  const line = quote(a).find((l) => l.party === party);
  if (!line) throw new BrokerageError("VALIDATION_FAILED", `The ${party} is not charged brokerage for this assignment.`);
  const d: BrokerageDisclosure = {
    id: newId("disc"), assignmentId: a.id, party, amount: line.amount, explanation: line.explanation,
    method, disclosedBy: actorId, disclosedAt: Date.now(), acknowledgedAt: null,
  };
  store().disclosures.push(d);
  audit(actorId, "brokerage.disclosed", "assignment", a.id, { party, amount: line.amount, method });
  return d;
}

export function addAssignmentOverride(a: Assignment, actorId: string, input: { party: Party; calcType: BrokerageOverride["calcType"]; value?: number | null; reason: string }) {
  const s = store();
  const user = s.users.get(actorId);
  if (!user || !(user.role === "super_admin" || user.canOverrideBrokerage)) {
    throw new BrokerageError("FORBIDDEN", "You don't have permission to override brokerage.");
  }
  if (!["draft", "pending_confirmation", "reserved"].includes(a.status)) {
    throw new BrokerageError("INVALID_STATUS_TRANSITION", "Overrides are only allowed before confirmation.");
  }
  const reason = input.reason?.trim() ?? "";
  const errors: Record<string, string[]> = {};
  if (reason.length < 3) errors.reason = ["A reason is required"];
  const value = input.calcType === "not_charged" ? null : Number(input.value);
  if (input.calcType !== "not_charged") {
    if (!Number.isFinite(value) || value! < 0) errors.value = ["Enter a valid amount"];
    else if (input.calcType === "percent_of_monthly_rent" && value! > 100) errors.value = ["Percentage cannot exceed 100"];
    else if (input.calcType === "months_of_rent" && value! < 1) errors.value = ["At least 1 month"];
  }
  if (Object.keys(errors).length) throw new BrokerageError("VALIDATION_FAILED", "Check the override", errors);
  const now = Date.now();
  const prev = activeOverride("assignment", a.id, input.party);
  if (prev) { prev.revokedAt = now; prev.revokedBy = actorId; prev.revokeReason = `Replaced: ${reason}`; }
  const o: BrokerageOverride = {
    id: newId("ovr"), level: "assignment", propertyId: null, assignmentId: a.id, party: input.party,
    calcType: input.calcType, value, reason, createdBy: actorId, createdAt: now, revokedAt: null, revokedBy: null, revokeReason: null,
  };
  s.overrides.push(o);
  audit(actorId, "brokerage.override_created", "assignment", a.id, { party: input.party, calcType: input.calcType, value, reason });
  return o;
}

/** On confirmation: one record per charged party, credited to the assignment's broker (D-15). */
export function createBrokerageRecords(a: Assignment, actorId: string, creditedBrokerId: string): BrokerageRecord[] {
  const { ready, missing } = readyToConfirm(a);
  if (!ready) {
    throw new BrokerageError("BROKERAGE_NOT_DISCLOSED", `Show the current brokerage amount to the ${missing.join(" and ")} before confirming.`);
  }
  const now = Date.now();
  const records = quote(a).map((l): BrokerageRecord => ({
    id: newId("brk"), assignmentId: a.id, party: l.party, source: l.source,
    calcSnapshot: { calcType: l.calcType, value: l.value, rentBase: l.rentBase, explanation: l.explanation },
    amount: l.amount, paidAmount: 0, refundedAmount: 0, status: "pending", waivedReason: null, waivedBy: null,
    creditedBrokerId,
    creditHistory: [{ previousBrokerId: null, newBrokerId: creditedBrokerId, reason: "Broker responsible for the confirmed assignment", authorizedBy: null, at: now }],
    createdAt: now,
  }));
  store().brokerages.push(...records);
  for (const r of records) audit(actorId, "brokerage.created", "brokerage", r.id, { party: r.party, amount: r.amount, credited: r.creditedBrokerId });
  return records;
}

function statusFromPayments(r: BrokerageRecord): BrokerageStatus {
  if (["waived", "cancelled", "refund_pending", "refunded"].includes(r.status)) return r.status;
  if (r.paidAmount >= r.amount) return "paid";
  return r.paidAmount > 0 ? "partially_paid" : "pending";
}

/** Manual payment recording only (D-08). */
export function recordPayment(r: BrokerageRecord, actorId: string, input: { amount: number; method: Payment["method"]; reference?: string; receivedAt?: string }): Payment {
  if (!["pending", "partially_paid"].includes(r.status)) throw new BrokerageError("INVALID_STATUS_TRANSITION", "This brokerage is not payable.");
  const amount = round2(Number(input.amount));
  const errors: Record<string, string[]> = {};
  if (!Number.isFinite(amount) || amount <= 0) errors.amount = ["Enter the amount received"];
  if (!["upi", "cash", "bank_transfer"].includes(input.method)) errors.method = ["Choose cash, UPI or bank transfer"];
  if (input.method !== "cash" && !input.reference?.trim()) errors.reference = ["Enter the UPI / bank reference"];
  if (Object.keys(errors).length) throw new BrokerageError("VALIDATION_FAILED", "Check the payment details", errors);
  if (r.paidAmount + amount > r.amount) throw new BrokerageError("OVERPAYMENT", `Only ${rupees(r.amount - r.paidAmount)} is outstanding.`);
  const s = store();
  const p: Payment = {
    id: newId("pay"), brokerageId: r.id, amount, method: input.method, reference: input.reference?.trim() || null,
    receivedAt: input.receivedAt ?? new Date().toISOString(),
    receiptNumber: `RC-${new Date().getFullYear()}-${String(++s.seq.receipt).padStart(6, "0")}`,
    recordedBy: actorId, createdAt: Date.now(),
  };
  s.payments.push(p);
  r.paidAmount = round2(r.paidAmount + amount);
  r.status = statusFromPayments(r);
  audit(actorId, "payment.recorded", "brokerage", r.id, { amount, method: p.method, receipt: p.receiptNumber });
  return p;
}

export const recordsFor = (assignmentId: string) => store().brokerages.filter((b) => b.assignmentId === assignmentId);

/** The student's own brokerage only: the record once confirmed, else the latest in-app disclosure. */
export function studentBrokerageView(leadId: string) {
  const s = store();
  const a = s.assignments.filter((x) => x.leadId === leadId && x.status !== "cancelled").sort((x, y) => y.createdAt - x.createdAt)[0];
  if (!a) return null;
  const rec = recordsFor(a.id).find((r) => r.party === "student");
  const d = latestDisclosure(a.id, "student");
  if (rec) {
    return { amount: rec.amount, explanation: rec.calcSnapshot.explanation, status: rec.status, paidAmount: rec.paidAmount, acknowledged: !!d?.acknowledgedAt, disclosureId: d?.id ?? null };
  }
  if (!d) return null;
  return { amount: d.amount, explanation: d.explanation, status: "pending" as BrokerageStatus, paidAmount: 0, acknowledged: d.acknowledgedAt !== null, disclosureId: d.id };
}
