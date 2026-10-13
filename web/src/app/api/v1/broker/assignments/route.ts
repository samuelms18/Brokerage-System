import { fromError, json, readJson, requireBrokerApi } from "@/lib/server/http";
import { createAssignment } from "@/lib/server/broker";

export async function POST(req: Request) {
  const auth = await requireBrokerApi();
  if (auth instanceof Response) return auth;
  const body = await readJson<{ lead_id?: string; bed_id?: string; move_in_date?: string }>(req);
  try {
    const a = createAssignment(auth.user.id, body?.lead_id ?? "", body?.bed_id ?? "", body?.move_in_date);
    return json({ id: a.id, code: a.code, status: a.status }, 201);
  } catch (e) { return fromError(e); }
}
