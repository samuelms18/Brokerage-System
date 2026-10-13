import { currentUser, json, problem } from "@/lib/server/http";
import { toMe } from "@/lib/server/me";

export async function GET() {
  const user = await currentUser();
  if (!user) return problem("UNAUTHENTICATED", "Log in to continue");
  return json(toMe(user));
}
