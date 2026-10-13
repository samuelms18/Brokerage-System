import { beforeEach, describe, expect, it } from "vitest";
import { resetStore, store } from "./store";
import { signUpStudent } from "./test-helpers";
import { createStudentRequest, eligibleBrokers, getStudentLead, listStudentRequests, RequestError } from "./requests";
import { setShortlisted } from "./shortlist";
import { accept } from "./broker";
import { toStudentRequest } from "./student-dto";

const visit = (code: string) => ({ property_code: code, type: "visit" as const, preferred_slots: [{ date: "2099-01-01", from: "17:00", to: "19:00" }] });

describe("request visit and lead allocation", () => {
  let studentId: string;
  beforeEach(() => {
    resetStore();
    studentId = signUpStudent("9876500010").id;
  });

  it("always answers with the same Request Received message", () => {
    const res = createStudentRequest(studentId, visit("PR-1001"));
    expect(res.title).toBe("Request Received");
    expect(res.message).toBe("Your property request has been received. Our broker will contact you shortly.");
  });

  it("offers the lead to the property's own broker first", () => {
    const { request_id } = createStudentRequest(studentId, visit("PR-1001"));
    const lead = getStudentLead(studentId, request_id)!;
    expect(lead.brokerId).toBe("u-broker-asha");
    expect(lead.allocationStatus).toBe("offered");
    expect(lead.responseDueAt).toBeGreaterThan(Date.now());
    expect(lead.assignments[0]).toMatchObject({ reason: "property_broker", method: "automatic" });
  });

  it("falls back to another authorized broker when the property broker is unavailable", () => {
    store().brokers.get("u-broker-asha")!.acceptingLeads = false;
    const { request_id } = createStudentRequest(studentId, visit("PR-1001"));
    const lead = getStudentLead(studentId, request_id)!;
    expect(lead.brokerId).toBe("u-broker-ravi"); // authorized for North Campus
    expect(lead.assignments[0].reason).toBe("authorized_fallback");
  });

  it("skips brokers on leave", () => {
    store().brokers.get("u-broker-asha")!.unavailable.push({ startsAt: Date.now() - 1000, endsAt: Date.now() + 3600_000 });
    const property = store().properties.find((p) => p.code === "PR-1001")!;
    expect(eligibleBrokers(property).map((b) => b.userId)).toEqual(["u-broker-ravi"]);
  });

  it("puts the lead in the Unassigned Queue when nobody is eligible", () => {
    for (const b of store().brokers.values()) b.acceptingLeads = false;
    const { request_id } = createStudentRequest(studentId, visit("PR-1001"));
    const lead = getStudentLead(studentId, request_id)!;
    expect(lead.allocationStatus).toBe("unassigned");
    expect(lead.brokerId).toBeNull();
    expect(lead.queuedAt).not.toBeNull();
    expect(lead.assignments[0].reason).toBe("no_eligible_broker");
  });

  it("reuses the active lead instead of creating a duplicate", () => {
    const a = createStudentRequest(studentId, visit("PR-1001"));
    const b = createStudentRequest(studentId, { property_code: "PR-1001", type: "interest" });
    expect(b.request_id).toBe(a.request_id);
    expect(store().leads).toHaveLength(1);
    expect(store().leads[0].assignments).toHaveLength(1); // not re-allocated
  });

  it("a double tap with the same Idempotency-Key creates one visit", () => {
    createStudentRequest(studentId, visit("PR-1001"), "key-1");
    createStudentRequest(studentId, visit("PR-1001"), "key-1");
    expect(store().visits).toHaveLength(1);
  });

  it("shortlisting does not create a lead", () => {
    setShortlisted(studentId, "PR-1001", true);
    expect(store().leads).toHaveLength(0);
  });

  it("rejects requests for properties students cannot see", () => {
    expect(() => createStudentRequest(studentId, visit("PR-1008"))).toThrow(RequestError);
  });

  it("validates visit slots", () => {
    expect(() => createStudentRequest(studentId, { property_code: "PR-1001", type: "visit", preferred_slots: [] })).toThrow(/highlighted/);
    expect(() => createStudentRequest(studentId, { property_code: "PR-1001", type: "visit", preferred_slots: [{ date: "2000-01-01" }] })).toThrow(RequestError);
  });

  it("shows broker contact only after the broker accepts", () => {
    const { request_id } = createStudentRequest(studentId, visit("PR-1001"));
    const before = toStudentRequest(getStudentLead(studentId, request_id)!, { studentId });
    expect(before.broker_contact).toBeNull();
    expect(before.display_status).toBe("request_received");
    accept("u-broker-asha", request_id);
    const after = toStudentRequest(getStudentLead(studentId, request_id)!, { studentId });
    expect(after.broker_contact?.display_name).toBe("Asha K.");
    expect(after.display_status).toBe("broker_contacted");
  });

  it("students cannot see each other's requests", () => {
    const { request_id } = createStudentRequest(studentId, visit("PR-1001"));
    const other = signUpStudent("9876500011").id;
    expect(getStudentLead(other, request_id)).toBeUndefined();
    expect(listStudentRequests(other, "all")).toHaveLength(0);
  });
});
