import type { components } from "@/lib/api-types";
import type { Assignment } from "./model";
import { latestDisclosure, quote, readyToConfirm } from "./brokerage";
import { money } from "./student-dto";

type S = components["schemas"];

/** BrokerageQuote: per charged party, the amount and whether it has been shown to them. */
export function quoteView(a: Assignment): S["BrokerageQuote"] {
  return {
    assignment_id: a.id,
    rent_base: money(a.rentSnapshot),
    lines: quote(a).map((l) => {
      const d = latestDisclosure(a.id, l.party);
      return {
        party: l.party, source: l.source, policy_id: l.policyId, override_id: l.overrideId,
        calc_type: l.calcType, value: money(l.value), amount: money(l.amount), explanation: l.explanation,
        disclosure: d
          ? { method: d.method, amount: money(d.amount), disclosed_at: new Date(d.disclosedAt).toISOString(),
              acknowledged_at: d.acknowledgedAt ? new Date(d.acknowledgedAt).toISOString() : null, matches_quote: d.amount === l.amount }
          : null,
      };
    }),
    ready_to_confirm: readyToConfirm(a).ready,
  };
}
