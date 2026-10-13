import { fromError, json, readJson, requireAdminApi } from "@/lib/server/http";
import { updateBroker } from "@/lib/server/admin";

export async function PATCH(req: Request, { params }: { params: Promise<{ brokerId: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;
  const body = await readJson<{ max_active_leads?: number; accepting_leads?: boolean }>(req);
  try {
    const b = updateBroker(auth.user.id, (await params).brokerId, { maxActiveLeads: body?.max_active_leads, acceptingLeads: body?.accepting_leads });
    return json({ id: b.userId, accepting_leads: b.acceptingLeads, max_active_leads: b.maxActiveLeads });
  } catch (e) { return fromError(e); }
}
