import { fromError, json, readJson, requireAdminApi } from "@/lib/server/http";
import { verifyProperty } from "@/lib/server/admin";

export async function POST(req: Request, { params }: { params: Promise<{ propertyId: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;
  const body = await readJson<{ decision?: "publish" | "reject"; note?: string; photos_checked?: boolean }>(req);
  try {
    const p = verifyProperty(auth.user.id, (await params).propertyId, { decision: body?.decision === "reject" ? "reject" : "publish", note: body?.note, photosChecked: body?.photos_checked });
    return json({ id: p.id, code: p.code, status: p.status });
  } catch (e) { return fromError(e); }
}
