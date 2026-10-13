import { fromError, json, readJson, requireBrokerApi } from "@/lib/server/http";
import { changeStatus } from "@/lib/server/broker";
import { toLeadDetail } from "@/lib/server/broker-dto";
import type { LeadStatus } from "@/lib/server/model";

export async function POST(req: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const auth = await requireBrokerApi();
  if (auth instanceof Response) return auth;
  const body = await readJson<{ to_status?: LeadStatus; reason?: string; next_action?: { action: string; due_at: string } }>(req);
  try {
    const lead = changeStatus(auth.user.id, (await params).leadId, {
      to: body?.to_status as LeadStatus, reason: body?.reason,
      nextAction: body?.next_action ? { action: body.next_action.action, dueAt: body.next_action.due_at } : undefined,
    });
    return json(toLeadDetail(lead, auth.user.id));
  } catch (e) { return fromError(e); }
}
