import { fromError, json, readJson, requireBrokerApi } from "@/lib/server/http";
import { proposeVisit } from "@/lib/server/broker";

export async function POST(req: Request, { params }: { params: Promise<{ visitId: string }> }) {
  const auth = await requireBrokerApi();
  if (auth instanceof Response) return auth;
  const body = await readJson<{ scheduled_at?: string }>(req);
  try {
    const v = proposeVisit(auth.user.id, (await params).visitId, body?.scheduled_at ?? "");
    return json({ id: v.id, status: v.status, scheduled_at: v.scheduledAt });
  } catch (e) { return fromError(e); }
}
