import { fromError, json, readJson, requireBrokerApi } from "@/lib/server/http";
import { recordPaymentFor } from "@/lib/server/broker";
import type { Payment } from "@/lib/server/model";
import { money } from "@/lib/server/student-dto";

export async function POST(req: Request, { params }: { params: Promise<{ brokerageId: string }> }) {
  const auth = await requireBrokerApi();
  if (auth instanceof Response) return auth;
  const body = await readJson<{ amount?: string | number; method?: Payment["method"]; reference?: string; received_at?: string }>(req);
  try {
    const p = recordPaymentFor(auth.user.id, (await params).brokerageId, {
      amount: Number(body?.amount), method: body?.method ?? "cash", reference: body?.reference, receivedAt: body?.received_at,
    });
    return json({ id: p.id, brokerage_id: p.brokerageId, amount: money(p.amount), method: p.method, reference: p.reference,
                  received_at: p.receivedAt, receipt_number: p.receiptNumber, status: "recorded", void_reason: null, recorded_by: p.recordedBy }, 201);
  } catch (e) { return fromError(e); }
}
