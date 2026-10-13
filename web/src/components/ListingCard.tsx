import Link from "next/link";
import type { components } from "@/lib/api-types";
import { GENDER_LABEL, PROPERTY_TYPE_LABEL, formatDate, inr, sharingLabel } from "@/lib/format";
import { ShortlistButton } from "./ShortlistButton";

type Card = components["schemas"]["StudentListingCard"];

export function AvailabilityBadge({ beds, from }: { beds: number; from?: string | null }) {
  if (beds === 0) {
    return <span className="whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-attention">{from ? `Full · free from ${formatDate(from)}` : "Full"}</span>;
  }
  return (
    <span className="whitespace-nowrap rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-success">
      {beds} bed{beds === 1 ? "" : "s"} available
    </span>
  );
}

export function ListingCard({ card }: { card: Card }) {
  return (
    <article className="card group relative overflow-hidden transition-shadow hover:shadow-md">
      <div className="relative aspect-[16/10] bg-canvas">
        {card.cover_photo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.cover_photo_url} alt="" className="h-full w-full object-cover" loading="lazy" />
        )}
        <div className="absolute right-2 top-2 z-10">
          <ShortlistButton code={card.code} initial={!!card.is_shortlisted} />
        </div>
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-ink">
          {PROPERTY_TYPE_LABEL[card.property_type]} · {GENDER_LABEL[card.gender_policy ?? "any"]}
        </span>
      </div>
      <div className="space-y-2 p-4">
        <h3 className="font-semibold leading-snug">
          <Link href={`/p/${card.code}`} className="after:absolute after:inset-0 after:content-['']">{card.title}</Link>
        </h3>
        <p className="text-sm text-muted">
          {card.area}
          {card.distance_km != null && <> · {card.distance_km} km from your college</>}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          {card.sharing_options?.map((s) => <span key={s} className="rounded-md bg-canvas px-2 py-1">{sharingLabel(s)}</span>)}
          {card.food_included && <span className="rounded-md bg-canvas px-2 py-1">Meals</span>}
        </div>
        <div className="flex items-end justify-between pt-1">
          <p>
            <span className="text-lg font-bold">{inr(card.rent_from)}</span>
            <span className="text-sm text-muted">/month</span>
            <span className="block text-xs text-muted">Deposit from {inr(card.deposit_from)}</span>
          </p>
          <AvailabilityBadge beds={card.available_beds} from={card.available_from} />
        </div>
      </div>
    </article>
  );
}
