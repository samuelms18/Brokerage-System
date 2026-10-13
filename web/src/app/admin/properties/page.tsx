import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/page-auth";
import { lookups, store } from "@/lib/server/store";
import { VerifyProperty } from "@/components/admin/actions";
import { PROPERTY_TYPE_LABEL, inr, sentence } from "@/lib/format";

export const metadata: Metadata = { title: "Properties" };

export default async function PropertiesPage() {
  await requireAdminPage("/admin/properties");
  const s = store();
  const queue = s.properties.filter((p) => p.status === "verification");
  const area = (id: string) => lookups.areas.find((a) => a.id === id)?.name;
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <h1 className="text-2xl font-bold">Properties</h1>
      <section className="card p-5" aria-labelledby="ver-h">
        <h2 id="ver-h" className="font-semibold">Verification queue <span className="text-muted">({queue.length})</span></h2>
        <p className="mt-1 text-sm text-muted">Nothing is visible to students until it is approved here.</p>
        {queue.length === 0 ? <p className="mt-3 text-sm text-muted">Nothing waiting.</p> : (
          <ul className="mt-3 space-y-4">
            {queue.map((p) => (
              <li key={p.id} className="grid gap-4 rounded-lg border border-line p-4 md:grid-cols-[1fr_380px]">
                <div>
                  <p className="font-semibold">{p.title} <span className="font-normal text-muted">· {p.code}</span></p>
                  <p className="text-sm text-muted">{PROPERTY_TYPE_LABEL[p.propertyType]} · {area(p.areaId)} · broker {s.brokers.get(p.brokerId)?.displayName}</p>
                  <p className="mt-1 text-sm">{p.rooms.length} room(s), {p.rooms.reduce((n, r) => n + r.beds.length, 0)} beds, from {inr(Math.min(...p.rooms.map((r) => r.rentPerBed)))}/month</p>
                  <div className="mt-3 flex gap-2">
                    {p.photos.map((ph, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={`data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 4 3'><rect width='4' height='3' fill='hsl(${ph.hue} 45% 80%)'/></svg>`)}`} alt={ph.caption} title={`${ph.caption}${ph.isPublic ? "" : " (private)"}`} className="h-14 w-20 rounded-md border border-line object-cover" />
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-muted">{p.photos.filter((ph) => ph.isPublic).length} public photo(s): {p.photos.filter((ph) => ph.isPublic).map((ph) => ph.caption).join(", ")}</p>
                </div>
                <VerifyProperty propertyId={p.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card overflow-x-auto" aria-labelledby="all-h">
        <h2 id="all-h" className="p-5 pb-0 font-semibold">All properties</h2>
        <table className="mt-3 w-full min-w-[600px] text-left text-sm">
          <thead className="border-y border-line text-muted"><tr><th className="p-3">Property</th><th className="p-3">Area</th><th className="p-3">Broker</th><th className="p-3">Beds free</th><th className="p-3">Status</th></tr></thead>
          <tbody className="divide-y divide-line">
            {s.properties.map((p) => (
              <tr key={p.id}>
                <td className="p-3"><span className="font-semibold">{p.title}</span><span className="block text-xs text-muted">{p.code}</span></td>
                <td className="p-3">{area(p.areaId)}</td>
                <td className="p-3">{s.brokers.get(p.brokerId)?.displayName}</td>
                <td className="p-3">{p.rooms.reduce((n, r) => n + r.beds.filter((b) => b.status === "available").length, 0)}</td>
                <td className="p-3">{sentence(p.status)}{p.verificationNote && <span className="block text-xs text-attention">Sent back: {p.verificationNote}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
