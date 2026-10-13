import { beforeEach, describe, expect, it } from "vitest";
import { resetStore, store } from "./store";
import { signUpStudent } from "./test-helpers";
import { createStudentRequest, getStudentLead } from "./requests";
import {
  accept, bedsForLead, brokerLead, changeStatus, confirmAssignment, createAssignment, decline, recordPaymentFor,
  setAvailability, sweep,
} from "./broker";
import { addAssignmentOverride, disclose, quote, readyToConfirm } from "./brokerage";
import { toLeadDetail } from "./broker-dto";
import { toStudentRequest } from "./student-dto";

const ASHA = "u-broker-asha";
const RAVI = "u-broker-ravi";
const visit = { property_code: "PR-1001", type: "visit" as const, preferred_slots: [{ date: "2099-01-01" }] };

let studentId: string;
let leadId: string;
beforeEach(() => {
  resetStore();
  studentId = signUpStudent("9876500100").id;
  leadId = createStudentRequest(studentId, visit).request_id;
});

function readyAssignment() {
  accept(ASHA, leadId);
  const bed = bedsForLead(ASHA, leadId).find((x) => x.bed.status === "available" && x.room.rentPerBed === 8500)!.bed;
  return createAssignment(ASHA, leadId, bed.id);
}

describe("accepting leads (D-14)", () => {
  it("hides the student's phone until the broker accepts", () => {
    const before = toLeadDetail(brokerLead(ASHA, leadId), ASHA);
    expect(before.student?.phone).toBeNull();
    accept(ASHA, leadId);
    const after = toLeadDetail(brokerLead(ASHA, leadId), ASHA);
    expect(after.student?.phone).toBe("+919876500100");
  });

  it("a declined lead moves to another broker and never comes back to the decliner", () => {
    decline(ASHA, leadId, "Fully booked this week");
    const lead = getStudentLead(studentId, leadId)!;
    expect(lead.brokerId).toBe(RAVI);
    expect(lead.assignments.at(-1)).toMatchObject({ previousBrokerId: ASHA, newBrokerId: RAVI, reason: "broker_declined" });
    expect(() => brokerLead(ASHA, leadId)).toThrow(/not found/);
    // Ravi times out: nobody else is eligible, so it queues rather than returning to Asha.
    sweep(Date.now() + 31 * 60_000);
    expect(lead.allocationStatus).toBe("unassigned");
    expect(lead.assignments.at(-1)?.reason).toBe("response_timeout");
  });

  it("a missed response window reassigns automatically", () => {
    sweep(Date.now() + 31 * 60_000);
    const lead = getStudentLead(studentId, leadId)!;
    expect(lead.brokerId).toBe(RAVI);
    expect(lead.assignments.at(-1)?.reason).toBe("response_timeout");
  });

  it("turning availability off moves offered leads but never accepted ones (AC8)", () => {
    const other = signUpStudent("9876500101").id;
    const accepted = createStudentRequest(other, visit).request_id;
    accept(ASHA, accepted);
    setAvailability(ASHA, false);
    expect(getStudentLead(studentId, leadId)!.brokerId).toBe(RAVI);
    expect(getStudentLead(other, accepted)!.brokerId).toBe(ASHA);
  });

  it("queued leads are picked up when a broker becomes available", () => {
    for (const b of store().brokers.values()) b.acceptingLeads = false;
    const other = signUpStudent("9876500102").id;
    const queued = createStudentRequest(other, { ...visit, property_code: "PR-1005" }).request_id;
    expect(getStudentLead(other, queued)!.allocationStatus).toBe("unassigned");
    setAvailability("u-broker-neha", true);
    expect(getStudentLead(other, queued)).toMatchObject({ brokerId: "u-broker-neha", allocationStatus: "offered" });
  });

  it("open leads always need a next action; closing needs a reason", () => {
    accept(ASHA, leadId);
    expect(() => changeStatus(ASHA, leadId, { to: "contacted" })).toThrow(/next action/);
    expect(() => changeStatus(ASHA, leadId, { to: "lost" })).toThrow(/reason/);
    changeStatus(ASHA, leadId, { to: "contacted", nextAction: { action: "Share 2 more options", dueAt: new Date(Date.now() + 3600_000).toISOString() } });
    expect(brokerLead(ASHA, leadId).followUps.filter((f) => f.status === "open")).toHaveLength(1);
  });
});

describe("assignment and brokerage (D-04, D-15)", () => {
  it("reserves the bed and blocks double-booking", () => {
    const a = readyAssignment();
    expect(store().properties.flatMap((p) => p.rooms).flatMap((r) => r.beds).find((b) => b.id === a.bedId)!.status).toBe("reserved");
    const other = signUpStudent("9876500103").id;
    const otherLead = createStudentRequest(other, visit).request_id;
    expect(() => createAssignment(ASHA, otherLead, a.bedId)).toThrow(/no longer available/);
  });

  it("quotes each party independently from the policy", () => {
    const a = readyAssignment();
    expect(quote(a).map((l) => [l.party, l.amount])).toEqual([["student", 4250], ["owner", 2000]]);
  });

  it("cannot confirm until every paying party has been shown the CURRENT amount", () => {
    const a = readyAssignment();
    expect(() => confirmAssignment(ASHA, a.id)).toThrow(/student and owner/);
    disclose(a, "student", "in_app", ASHA);
    disclose(a, "owner", "whatsapp", ASHA);
    expect(readyToConfirm(a).ready).toBe(true);
    // An override changes the amount, so the student must be shown it again.
    addAssignmentOverride(a, ASHA, { party: "student", calcType: "flat", value: 3000, reason: "Early-bird discount" });
    expect(readyToConfirm(a)).toEqual({ ready: false, missing: ["student"] });
    expect(() => confirmAssignment(ASHA, a.id)).toThrow(/student/);
  });

  it("overrides need permission and a reason", () => {
    const a = readyAssignment();
    expect(() => addAssignmentOverride(a, ASHA, { party: "student", calcType: "flat", value: 1, reason: "" })).toThrow(/override/);
    store().users.get(ASHA)!.canOverrideBrokerage = false;
    expect(() => addAssignmentOverride(a, ASHA, { party: "student", calcType: "flat", value: 1, reason: "x x x" })).toThrow(/permission/);
  });

  it("confirmation creates one record per party, credited to the confirming broker, unaffected by later reassignment", () => {
    const a = readyAssignment();
    disclose(a, "student", "in_app", ASHA);
    disclose(a, "owner", "phone", ASHA);
    confirmAssignment(ASHA, a.id);
    const recs = store().brokerages.filter((r) => r.assignmentId === a.id);
    expect(recs.map((r) => [r.party, r.amount, r.status, r.creditedBrokerId])).toEqual([
      ["student", 4250, "pending", ASHA], ["owner", 2000, "pending", ASHA],
    ]);
    expect(getStudentLead(studentId, leadId)!.status).toBe("brokerage_pending");
    // Manual lead reassignment afterwards does not move credit.
    getStudentLead(studentId, leadId)!.brokerId = RAVI;
    expect(store().brokerages.every((r) => r.creditedBrokerId === ASHA)).toBe(true);
  });

  it("tracks each party's payments separately and blocks overpayment", () => {
    const a = readyAssignment();
    disclose(a, "student", "in_app", ASHA);
    disclose(a, "owner", "phone", ASHA);
    confirmAssignment(ASHA, a.id);
    const [student, owner] = store().brokerages.filter((r) => r.assignmentId === a.id);
    expect(() => recordPaymentFor(ASHA, student.id, { amount: 100, method: "upi" })).toThrow(/payment details/);
    recordPaymentFor(ASHA, student.id, { amount: 2000, method: "upi", reference: "UPI123" });
    expect(student.status).toBe("partially_paid");
    expect(() => recordPaymentFor(ASHA, student.id, { amount: 5000, method: "cash" })).toThrow(/outstanding/);
    recordPaymentFor(ASHA, student.id, { amount: 2250, method: "cash" });
    expect(student.status).toBe("paid");
    expect(owner.status).toBe("pending");
    expect(getStudentLead(studentId, leadId)!.status).toBe("brokerage_pending");
    recordPaymentFor(ASHA, owner.id, { amount: 2000, method: "bank_transfer", reference: "UTR9" });
    expect(getStudentLead(studentId, leadId)!.status).toBe("brokerage_paid");
  });

  it("the student sees only their own brokerage amount", () => {
    const a = readyAssignment();
    disclose(a, "owner", "phone", ASHA);
    expect(toStudentRequest(getStudentLead(studentId, leadId)!, { studentId }).brokerage).toBeNull();
    disclose(a, "student", "in_app", ASHA);
    const view = toStudentRequest(getStudentLead(studentId, leadId)!, { studentId });
    expect(view.brokerage?.amount).toBe("4250.00");
    expect(JSON.stringify(view)).not.toContain('"2000.00"'); // owner's amount
    expect(Object.keys(view.brokerage!)).toEqual(["amount", "explanation", "status", "paid_amount", "acknowledged"]);
  });
});
