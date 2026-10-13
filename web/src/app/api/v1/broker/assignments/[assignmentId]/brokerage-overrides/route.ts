import { fromError, json, readJson, requireBrokerApi } from "@/lib/server/http";
import { brokerAssignment } from "@/lib/server/broker";
import { addAssignmentOverride } from "@/lib/server/brokerage";
import type { BrokerageOverride, Party } from "@/lib/server/model";

export async function POST(req: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  const auth = await requireBrokerApi();
  if (auth instanceof Response) return auth;
  const body = await readJson<{ party?: Party; calc_type?: BrokerageOverride["calcType"]; value?: string | number; reason?: string }>(req);
  try {
    const { a } = brokerAssignment(auth.user.id, (await params).assignmentId);
    const o = addAssignmentOverride(a, auth.user.id, {
      party: body?.party ?? "student", calcType: body?.calc_type ?? "flat",
      value: body?.value === undefined || body?.value === "" ? null : Number(body.value), reason: body?.reason ?? "",
    });
    return json({ id: o.id, party: o.party, calc_type: o.calcType, value: o.value, reason: o.reason }, 201);
  } catch (e) { return fromError(e); }
}
