import { json, problem, requireAdminApi } from "@/lib/server/http";
import { store } from "@/lib/server/store";

export async function GET(_req: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;
  const { leadId } = await params;
  const s = store();
  const lead = s.leads.find((l) => l.id === leadId);
  if (!lead) return problem("NOT_FOUND", "Lead not found");
  const who = (id: string | null) => (id ? { id, name: s.users.get(id)?.name ?? id } : null);
  return json({
    data: lead.assignments.map((e, i) => ({
      id: `${lead.id}-${i}`, lead_id: lead.id, previous_broker: who(e.previousBrokerId), new_broker: who(e.newBrokerId),
      method: e.method, reason: e.reason, reason_note: e.note ?? null,
      response_due_at: e.responseDueAt ? new Date(e.responseDueAt).toISOString() : null, assigned_by: null,
      accepted_at: e.acceptedAt ? new Date(e.acceptedAt).toISOString() : null,
      ended_at: lead.assignments[i + 1] ? new Date(lead.assignments[i + 1].at).toISOString() : null,
      created_at: new Date(e.at).toISOString(),
    })),
  });
}
