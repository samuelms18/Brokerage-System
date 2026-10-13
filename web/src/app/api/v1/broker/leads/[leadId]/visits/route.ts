import { fromError, json, readJson, requireBrokerApi } from "@/lib/server/http";
import { scheduleVisit } from "@/lib/server/broker";

export async function POST(req: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const auth = await requireBrokerApi();
  if (auth instanceof Response) return auth;
  const body = await readJson<{ scheduled_at?: string }>(req);
  try {
    const v = scheduleVisit(auth.user.id, (await params).leadId, body?.scheduled_at ?? "");
    return json({ id: v.id, status: v.status, scheduled_at: v.scheduledAt }, 201);
  } catch (e) { return fromError(e); }
}
