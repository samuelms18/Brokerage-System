import { fromError, json, requireBrokerApi } from "@/lib/server/http";
import { brokerAssignment } from "@/lib/server/broker";
import { quoteView } from "@/lib/server/brokerage-dto";

export async function GET(_req: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  const auth = await requireBrokerApi();
  if (auth instanceof Response) return auth;
  try {
    return json(quoteView(brokerAssignment(auth.user.id, (await params).assignmentId).a));
  } catch (e) { return fromError(e); }
}
