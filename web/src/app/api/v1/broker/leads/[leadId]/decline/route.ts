import { fromError, readJson, requireBrokerApi } from "@/lib/server/http";
import { decline } from "@/lib/server/broker";

export async function POST(req: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const auth = await requireBrokerApi();
  if (auth instanceof Response) return auth;
  const body = await readJson<{ reason?: string }>(req);
  try {
    decline(auth.user.id, (await params).leadId, body?.reason ?? "");
    return new Response(null, { status: 204 });
  } catch (e) { return fromError(e); }
}
