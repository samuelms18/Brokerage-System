import { fromError, json, readJson, requireBrokerApi } from "@/lib/server/http";
import { recordVisitOutcome } from "@/lib/server/broker";

export async function POST(req: Request, { params }: { params: Promise<{ visitId: string }> }) {
  const auth = await requireBrokerApi();
  if (auth instanceof Response) return auth;
  const body = await readJson<{ status?: "completed" | "no_show" | "cancelled"; outcome?: string; note?: string }>(req);
  try {
    const v = recordVisitOutcome(auth.user.id, (await params).visitId, { status: body?.status ?? "completed", outcome: body?.outcome, note: body?.note });
    return json({ id: v.id, status: v.status });
  } catch (e) { return fromError(e); }
}
