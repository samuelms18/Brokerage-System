import { beforeEach, describe, expect, it } from "vitest";
import { resetStore, store } from "./store";
import { signUpStudent } from "./test-helpers";
import { listingDetail, searchListings, parseListingQuery } from "./listings";
import { createStudentRequest, listStudentRequests } from "./requests";
import { accept, bedsForLead, createAssignment } from "./broker";
import { disclose } from "./brokerage";
import { shortlistCards, setShortlisted } from "./shortlist";
import * as seed from "./seed";

/** Every private value in the demo data. None may appear in student output. */
function privateValues(): string[] {
  const values: string[] = [];
  for (const o of seed.owners) values.push(o.name, o.phone, o.email, o.address, o.phone.slice(3));
  for (const p of seed.properties) {
    values.push(p.private.addressLine1, String(p.private.latitude), String(p.private.longitude), p.private.ownerId);
    if (p.private.landmark) values.push(p.private.landmark);
    for (const ph of p.photos) if (!ph.isPublic) values.push(ph.caption);
  }
  for (const b of seed.staffUsers) values.push(b.phone, b.id);
  return values;
}

const FORBIDDEN_KEYS = /"(owner\w*|address\w*|pincode|landmark|latitude_exact|broker_?id|allocation\w*|response_due\w*|private|assignments)"\s*:/i;

function assertStudentSafe(payload: unknown) {
  const text = JSON.stringify(payload);
  for (const v of privateValues()) expect(text, `leaked "${v}"`).not.toContain(v);
  expect(text).not.toMatch(FORBIDDEN_KEYS);
}

describe("student responses never contain private data", () => {
  let studentId: string;
  beforeEach(() => {
    resetStore();
    studentId = signUpStudent("9876500001").id;
  });

  it("search results", () => {
    const all = searchListings(parseListingQuery(new URLSearchParams()), { studentId });
    expect(all.data.length).toBeGreaterThan(0);
    assertStudentSafe(all);
  });

  it("every property detail", () => {
    for (const p of store().properties) {
      const d = listingDetail(p.code, { studentId, collegeId: "col-wit" });
      if (d) assertStudentSafe(d);
    }
  });

  it("requests, including after broker acceptance and brokerage disclosure", () => {
    const { request_id } = createStudentRequest(studentId, { property_code: "PR-1001", type: "visit", preferred_slots: [{ date: "2099-01-01" }] });
    accept("u-broker-asha", request_id);
    const bed = bedsForLead("u-broker-asha", request_id).find((x) => x.bed.status === "available")!.bed;
    const a = createAssignment("u-broker-asha", request_id, bed.id);
    disclose(a, "student", "in_app", "u-broker-asha");
    disclose(a, "owner", "phone", "u-broker-asha");
    const reqs = listStudentRequests(studentId, "all");
    // Broker's BUSINESS phone is allowed once accepted; staff personal phones are not.
    expect(JSON.stringify(reqs)).toContain("+912040000011");
    assertStudentSafe(reqs);
  });

  it("shortlist", () => {
    setShortlisted(studentId, "PR-1003", true);
    assertStudentSafe(shortlistCards(studentId, null));
  });

  it("private photos are not listed", () => {
    const d = listingDetail("PR-1001", { studentId })!;
    expect(d.photos).toHaveLength(3);
    expect(d.photos.map((p) => p.caption)).not.toContain("Front gate with house number");
  });
});

describe("only verified, available properties are visible", () => {
  beforeEach(() => resetStore());

  it("hides properties awaiting verification and fully occupied ones", () => {
    const studentId = signUpStudent("9876500002").id;
    const codes = searchListings(parseListingQuery(new URLSearchParams()), { studentId }).data.map((c) => c.code);
    expect(codes).not.toContain("PR-1008"); // verification
    expect(codes).not.toContain("PR-1007"); // fully occupied
    expect(listingDetail("PR-1008", { studentId })).toBeNull();
  });
});
