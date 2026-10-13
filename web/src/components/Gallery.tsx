"use client";

import { useState } from "react";

export function Gallery({ photos, title }: { photos: { url: string; caption?: string | null }[]; title: string }) {
  const [i, setI] = useState(0);
  if (photos.length === 0) return <div className="card grid aspect-[16/9] place-items-center text-muted">Photos coming soon</div>;
  const current = photos[i];
  return (
    <div>
      <figure className="card relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.url} alt={current.caption ?? title} className="aspect-[16/10] w-full object-cover md:aspect-[16/9]" />
        <figcaption className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
          {current.caption} · {i + 1}/{photos.length}
        </figcaption>
        {photos.length > 1 && (
          <>
            <button type="button" aria-label="Previous photo" onClick={() => setI((i - 1 + photos.length) % photos.length)}
                    className="absolute left-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-lg shadow">‹</button>
            <button type="button" aria-label="Next photo" onClick={() => setI((i + 1) % photos.length)}
                    className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-lg shadow">›</button>
          </>
        )}
      </figure>
      {photos.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {photos.map((p, idx) => (
            <button key={p.url} type="button" onClick={() => setI(idx)} aria-label={`Show photo ${idx + 1}: ${p.caption ?? ""}`}
                    aria-current={idx === i} className={`h-16 w-24 flex-none overflow-hidden rounded-lg border-2 ${idx === i ? "border-brand-500" : "border-transparent"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
