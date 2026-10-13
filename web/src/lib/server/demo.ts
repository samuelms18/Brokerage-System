// PROTOTYPE ONLY: creates sample activity so the Super Admin screens have
// something to show on a fresh server. Uses the real flows, nothing is
// written directly. Not part of the API contract.

import { audit, store } from "./store";
import { requestOtp, verifyOtp } from "./auth";
import { createStudentRequest } from "./requests";
import { accept, bedsForLead, confirmAssignment, createAssignment, recordPaymentFor } from "./broker";
import { disclose } from "./brokerage";
import { addUnavailability } from "./admin";

function student(phone: string, name: string) {
  const existing = [...store().users.values()].find((u) => u.phone === `+91${phone}`);
  if (existing) return existing.id;
  const { challengeId } = requestOtp(phone);
  return verifyOtp(challengeId, "123456", name).user.id;
}

const slot = () => [{ date: new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10), from: "16:00", to: "20:00" }];

export function seedDemoActivity(adminId: string) {
  // 1. Neha (the only Hill Road broker) is on leave, so a Hill Road request waits in the Unassigned Queue.
  addUnavailability(adminId, "u-broker-neha", {
    kind: "leave", startsAt: new Date(Date.now() - 3600_000).toISOString(), endsAt: new Date(Date.now() + 2 * 86400_000).toISOString(), reason: "Family function",
  });
  createStudentRequest(student("9555000001", "Kabir Shah"), { property_code: "PR-1005", type: "visit", preferred_slots: slot() });

  // 2. A Riverside request offered to Ravi, not yet accepted.
  createStudentRequest(student("9555000002", "Ananya Rao"), { property_code: "PR-1003", type: "visit", preferred_slots: slot() });

  // 3. A completed North Campus rental: confirmed, student part-paid, owner unpaid.
  const sid = student("9555000003", "Ishaan Verma");
  const { request_id } = createStudentRequest(sid, { property_code: "PR-1002", type: "interest" });
  accept("u-broker-asha", request_id);
  const bed = bedsForLead("u-broker-asha", request_id).find((x) => x.bed.status === "available")!.bed;
  const a = createAssignment("u-broker-asha", request_id, bed.id);
  disclose(a, "student", "in_app", "u-broker-asha");
  disclose(a, "owner", "phone", "u-broker-asha");
  confirmAssignment("u-broker-asha", a.id);
  const studentRecord = store().brokerages.find((r) => r.assignmentId === a.id && r.party === "student")!;
  recordPaymentFor("u-broker-asha", studentRecord.id, { amount: 1000, method: "upi", reference: "UPI-DEMO-001" });

  audit(adminId, "prototype.demo_activity_loaded", "system", "demo");
}
