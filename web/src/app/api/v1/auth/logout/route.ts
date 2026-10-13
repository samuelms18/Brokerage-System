import { cookies } from "next/headers";
import { SESSION_COOKIE, revokeSession } from "@/lib/server/auth";

export async function POST() {
  const jar = await cookies();
  revokeSession(jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
  return new Response(null, { status: 204 });
}
