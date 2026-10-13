import { fromError, json, readJson, requireBrokerApi } from "@/lib/server/http";
import { setAvailability } from "@/lib/server/broker";

export async function PUT(req: Request) {
  const auth = await requireBrokerApi();
  if (auth instanceof Response) return auth;
  const body = await readJson<{ accepting_leads?: boolean }>(req);
  try {
    const b = setAvailability(auth.user.id, !!body?.accepting_leads);
    return json({ accepting_leads: b.acceptingLeads, max_active_leads: b.maxActiveLeads });
  } catch (e) { return fromError(e); }
}
