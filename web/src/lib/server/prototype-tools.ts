// PROTOTYPE ONLY. Simulates broker-side actions that the broker app (step 2
// of the prototype plan) will perform, so the student screens can be shown
// end to end. Disabled with PROTOTYPE_TOOLS=off. Not part of the API contract.

import { store } from "./store";
import { getStudentLead, RequestError } from "./requests";
import { activeRooms } from "./student-dto";

export function simulateBrokerAccept(studentId: string, leadId: string) {
  const lead = getStudentLead(studentId, leadId);
  if (!lead) throw new RequestError("NOT_FOUND", "Request not found");
  if (lead.allocationStatus === "accepted") return lead;
  const s = store();
  if (!lead.brokerId) {
    const property = s.properties.find((p) => p.id === lead.propertyId)!;
    lead.brokerId = property.brokerId;
  }
  const now = Date.now();
  lead.allocationStatus = "accepted";
  lead.responseDueAt = null;
  lead.queuedAt = null;
  lead.status = lead.status === "new" ? "contacted" : lead.status;
  lead.updatedAt = now;
  lead.timeline.push({ at: now, label: "A broker is handling your request" });
  return lead;
}

/**
 * Shows the student a brokerage amount, as the broker's "disclose to student
 * (in-app)" action would. The amount comes from an EXAMPLE policy only: the
 * real formula is configured by Super Admin (docs/brokerage.md).
 */
export function simulateBrokerageDisclosure(studentId: string, leadId: string) {
  const lead = getStudentLead(studentId, leadId);
  if (!lead) throw new RequestError("NOT_FOUND", "Request not found");
  if (lead.allocationStatus !== "accepted") {
    throw new RequestError("INVALID_STATUS_TRANSITION", "A broker must accept the request first.");
  }
  const property = store().properties.find((p) => p.id === lead.propertyId)!;
  const room = activeRooms(property).find((r) => r.beds.some((b) => b.status === "available")) ?? activeRooms(property)[0];
  const rent = room.rentPerBed;
  const now = Date.now();
  lead.studentBrokerage = {
    amount: Math.round(rent * 0.5 * 100) / 100,
    explanation: `50% of one month's rent (₹${rent.toLocaleString("en-IN")}): example policy`,
    status: "pending",
    paidAmount: 0,
    acknowledgedAt: null,
  };
  lead.status = "negotiation";
  lead.updatedAt = now;
  lead.timeline.push({ at: now, label: "Brokerage amount shared with you" });
  return lead;
}
