import { fromError, json, requireAdminApi } from "@/lib/server/http";
import { deactivatePolicy } from "@/lib/server/admin";

export async function POST(_req: Request, { params }: { params: Promise<{ policyId: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;
  try { return json(deactivatePolicy(auth.user.id, (await params).policyId)); } catch (e) { return fromError(e); }
}
