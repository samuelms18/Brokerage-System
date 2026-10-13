import { beforeEach, describe, expect, it } from "vitest";
import { resetStore, store } from "./store";
import { signUpStudent } from "./test-helpers";
import { createStudentRequest, getStudentLead } from "./requests";
import { accept, bedsForLead, confirmAssignment, createAssignment, recordPaymentFor } from "./broker";
import { disclose, quote } from "./brokerage";
import {
  addUnavailability, cancelRefund, cancelUnavailability, completeRefund, createPolicy, manualReassign, overrideCredit,
  requestRefund, unassignedQueue, updateBroker, verifyProperty, waive,
} from "./admin";
import { findStudentVisible } from "./listings";

const ADMIN = "u-admin";
const ASHA = "u-broker-asha";
const visit = (code: string) => ({ property_code: code, type: "visit" as const, preferred_slots: [{ date: "2099-01-01" }] });

beforeEach(() => resetStore());

function confirmedRental() {
  const sid = signUpStudent("9876500200").id;
  const id = createStudentRequest(sid, visit("PR-1001")).request_id;
  accept(ASHA, id);
  const bed = bedsForLead(ASHA, id).find((x) => x.bed.status === "available" && x.room.rentPerBed === 8500)!.bed;
  const a = createAssignment(ASHA, id, bed.id);
  disclose(a, "student", "in_app", ASHA);
  disclose(a, "owner", "phone", ASHA);
  confirmAssignment(ASHA, a.id);
  const [student, owner] = store().brokerages.filter((r) => r.assignmentId === a.id);
  return { sid, leadId: id, a, student, owner };
}

describe("property verification (D-06)", () => {
  it("publishes only after the photo privacy check, and the property then becomes visible", () => {
    expect(findStudentVisible("PR-1008")).toBeUndefined();
    expect(() => verifyProperty(ADMIN, "prop-1008", { decision: "publish" })).toThrow(/house number/);
    verifyProperty(ADMIN, "prop-1008", { decision: "publish", photosChecked: true });
    expect(findStudentVisible("PR-1008")?.status).toBe("published");
  });

  it("rejecting needs a note and returns the property to draft", () => {
    expect(() => verifyProperty(ADMIN, "prop-1008", { decision: "reject" })).toThrow(/reason/);
    verifyProperty(ADMIN, "prop-1008", { decision: "reject", note: "Photo 1 shows the gate number" });
    expect(store().properties.find((p) => p.id === "prop-1008")).toMatchObject({ status: "draft", verificationNote: "Photo 1 shows the gate number" });
  });
});

describe("broker availability and allocation", () => {
  it("leave moves offered leads now; cancelling the leave lets the queue retry", () => {
    const sid = signUpStudent("9876500201").id;
    const id = createStudentRequest(sid, visit("PR-1005")).request_id; // Hill Road: only Neha
    expect(getStudentLead(sid, id)!.brokerId).toBe("u-broker-neha");
    const w = addUnavailability(ADMIN, "u-broker-neha", { kind: "leave", startsAt: new Date(Date.now() - 1000).toISOString(), endsAt: new Date(Date.now() + 86400_000).toISOString() });
    expect(getStudentLead(sid, id)!.allocationStatus).toBe("unassigned");
    expect(unassignedQueue().map((l) => l.id)).toEqual([id]);
    // Neha is excluded for this lead (went unavailable), so the queue waits for someone else.
    cancelUnavailability(ADMIN, w.id);
    expect(getStudentLead(sid, id)!.allocationStatus).toBe("unassigned");
    manualReassign(ADMIN, id, "u-broker-neha", "Neha is back early and knows this property");
    expect(getStudentLead(sid, id)).toMatchObject({ brokerId: "u-broker-neha", allocationStatus: "accepted" });
  });

  it("manual reassignment needs a reason and keeps the full history", () => {
    const sid = signUpStudent("9876500202").id;
    const id = createStudentRequest(sid, visit("PR-1001")).request_id;
    expect(() => manualReassign(ADMIN, id, "u-broker-ravi", "")).toThrow(/reason/);
    manualReassign(ADMIN, id, "u-broker-ravi", "Student asked for a Marathi-speaking broker");
    const events = getStudentLead(sid, id)!.assignments;
    expect(events.map((e) => [e.previousBrokerId, e.newBrokerId, e.method, e.reason])).toEqual([
      [null, ASHA, "automatic", "property_broker"],
      [ASHA, "u-broker-ravi", "manual", "manual_reassignment"],
    ]);
  });

  it("capacity changes take effect for allocation", () => {
    updateBroker(ADMIN, ASHA, { maxActiveLeads: 0 });
    const sid = signUpStudent("9876500203").id;
    const id = createStudentRequest(sid, visit("PR-1001")).request_id;
    expect(getStudentLead(sid, id)!.brokerId).toBe("u-broker-ravi");
  });
});

describe("brokerage policies (D-04)", () => {
  it("a new version replaces the old one; both are kept", () => {
    const p = createPolicy(ADMIN, { name: "Owner pays 1 month", payerMode: "owner", owner: { calcType: "months_of_rent", value: 1 } }, "pol-example");
    expect(store().policies.map((x) => [x.id === p.id ? "new" : x.id, x.isActive])).toEqual([["pol-example", false], ["new", true]]);
    const { a } = (() => {
      const sid = signUpStudent("9876500204").id;
      const id = createStudentRequest(sid, visit("PR-1001")).request_id;
      accept(ASHA, id);
      const bed = bedsForLead(ASHA, id).find((x) => x.bed.status === "available" && x.room.rentPerBed === 8500)!.bed;
      return { a: createAssignment(ASHA, id, bed.id) };
    })();
    expect(quote(a).map((l) => [l.party, l.amount])).toEqual([["owner", 8500]]);
  });

  it("validates per-party calculations like the database does", () => {
    expect(() => createPolicy(ADMIN, { name: "x", payerMode: "both", student: { calcType: "flat", value: 1 } })).toThrow(/Check the policy/);
    expect(() => createPolicy(ADMIN, { name: "x", payerMode: "student", student: { calcType: "percent_of_monthly_rent", value: 120 } })).toThrow();
    expect(() => createPolicy(ADMIN, { name: "x", payerMode: "owner", owner: { calcType: "months_of_rent", value: 0.5 } })).toThrow();
  });
});

describe("waivers, refunds and credit", () => {
  it("waives the outstanding balance with a reason; waived records accept no payments", () => {
    const { owner, sid, leadId, student } = confirmedRental();
    expect(() => waive(ADMIN, owner.id, "")).toThrow(/reason/);
    waive(ADMIN, owner.id, "Owner referred three students this term");
    expect(owner).toMatchObject({ status: "waived", waivedBy: ADMIN });
    expect(() => recordPaymentFor(ASHA, owner.id, { amount: 10, method: "cash" })).toThrow(/not payable/);
    recordPaymentFor(ASHA, student.id, { amount: student.amount, method: "cash" });
    expect(getStudentLead(sid, leadId)!.status).toBe("brokerage_paid");
  });

  it("refunds go pending → completed, capped at what was paid", () => {
    const { student } = confirmedRental();
    recordPaymentFor(ASHA, student.id, { amount: 3000, method: "upi", reference: "U1" });
    expect(() => requestRefund(ADMIN, student.id, 5000, "Moved out early")).toThrow(/At most/);
    const r = requestRefund(ADMIN, student.id, 1000, "Moved out early");
    expect(student.status).toBe("refund_pending");
    expect(() => completeRefund(ADMIN, r.id, { method: "upi" })).toThrow(/reference/);
    completeRefund(ADMIN, r.id, { method: "upi", reference: "R1" });
    expect(student).toMatchObject({ status: "refunded", refundedAmount: 1000 });
  });

  it("a cancelled refund restores the payment status", () => {
    const { student } = confirmedRental();
    recordPaymentFor(ASHA, student.id, { amount: 3000, method: "upi", reference: "U1" });
    const r = requestRefund(ADMIN, student.id, 500, "Duplicate charge?");
    cancelRefund(ADMIN, r.id, "Not a duplicate");
    expect(student.status).toBe("partially_paid");
  });

  it("credit changes only by Super Admin override, with history", () => {
    const { owner } = confirmedRental();
    expect(() => overrideCredit(ADMIN, owner.id, "u-broker-ravi", "")).toThrow(/reason/);
    overrideCredit(ADMIN, owner.id, "u-broker-ravi", "Ravi sourced this owner");
    expect(owner.creditedBrokerId).toBe("u-broker-ravi");
    expect(owner.creditHistory.map((h) => [h.previousBrokerId, h.newBrokerId, h.authorizedBy])).toEqual([
      [null, ASHA, null], [ASHA, "u-broker-ravi", ADMIN],
    ]);
  });
});

describe("prototype sample activity", () => {
  it("creates a queued lead, an offered lead and a confirmed, part-paid rental", async () => {
    const { seedDemoActivity } = await import("./demo");
    seedDemoActivity(ADMIN);
    const s = store();
    expect(unassignedQueue()).toHaveLength(1);
    expect(s.leads.filter((l) => l.allocationStatus === "offered")).toHaveLength(1);
    expect(s.brokerages.map((r) => [r.party, r.status])).toEqual([["student", "partially_paid"], ["owner", "pending"]]);
  });
});
