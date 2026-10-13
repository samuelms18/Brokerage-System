import { problem, requireStudentApi } from "@/lib/server/http";
import { setShortlisted } from "@/lib/server/shortlist";

async function handle(params: Promise<{ code: string }>, on: boolean) {
  const auth = await requireStudentApi();
  if (auth instanceof Response) return auth;
  const { code } = await params;
  // Shortlisting never creates a lead or notifies a broker (D-16).
  if (!setShortlisted(auth.user.id, code, on)) return problem("NOT_FOUND", "Property not found");
  return new Response(null, { status: 204 });
}

export async function PUT(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  return handle(params, true);
}
export async function DELETE(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  return handle(params, false);
}
