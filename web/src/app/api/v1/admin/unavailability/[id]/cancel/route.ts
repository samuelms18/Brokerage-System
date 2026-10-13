import { fromError, requireAdminApi } from "@/lib/server/http";
import { cancelUnavailability } from "@/lib/server/admin";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;
  try {
    cancelUnavailability(auth.user.id, (await params).id);
    return new Response(null, { status: 204 });
  } catch (e) { return fromError(e); }
}
