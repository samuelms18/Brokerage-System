import { fromError, json, readJson, requireAdminApi } from "@/lib/server/http";
import { overrideCredit } from "@/lib/server/admin";

export async function POST(req: Request, { params }: { params: Promise<{ brokerageId: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;
  const b = await readJson<{ broker_id?: string; reason?: string }>(req);
  const id = (await params).brokerageId;
  try { return json(overrideCredit(auth.user.id, id, b?.broker_id ?? "", b?.reason ?? ""), 200); } catch (e) { return fromError(e); }
}
