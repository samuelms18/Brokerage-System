import { fromError, json, readJson, requireAdminApi } from "@/lib/server/http";
import { waive } from "@/lib/server/admin";

export async function POST(req: Request, { params }: { params: Promise<{ brokerageId: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;
  const b = await readJson<{ reason?: string }>(req);
  const id = (await params).brokerageId;
  try { return json(waive(auth.user.id, id, b?.reason ?? ""), 200); } catch (e) { return fromError(e); }
}
