import { fromError, json, readJson, requireBrokerApi } from "@/lib/server/http";
import { brokerAssignment } from "@/lib/server/broker";
import { disclose } from "@/lib/server/brokerage";
import { quoteView } from "@/lib/server/brokerage-dto";
import type { BrokerageDisclosure, Party } from "@/lib/server/model";

export async function POST(req: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  const auth = await requireBrokerApi();
  if (auth instanceof Response) return auth;
  const body = await readJson<{ party?: Party; method?: BrokerageDisclosure["method"] }>(req);
  try {
    const { a, lead } = brokerAssignment(auth.user.id, (await params).assignmentId);
    const d = disclose(a, body?.party ?? "student", body?.method ?? "in_app", auth.user.id);
    if (d.party === "student") lead.timeline.push({ at: d.disclosedAt, label: "Brokerage amount shared with you" });
    return json(quoteView(a), 201);
  } catch (e) { return fromError(e); }
}
