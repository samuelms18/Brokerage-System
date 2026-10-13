/** Abstract area map: shows only a ~500 m circle, never a pin (D-03). */
export function ApproxMap({ area, radius }: { area: string; radius: number }) {
  return (
    <figure className="card overflow-hidden">
      <svg viewBox="0 0 400 200" className="h-44 w-full bg-[#eef3ef]" role="img" aria-label={`Approximate area: ${area}`}>
        <g stroke="#fff" strokeWidth="10" fill="none">
          <path d="M-10 60 C 120 40, 220 90, 410 70" />
          <path d="M-10 150 C 140 160, 260 120, 410 150" />
          <path d="M90 -10 C 110 80, 70 140, 100 210" />
          <path d="M290 -10 C 270 70, 320 140, 300 210" />
        </g>
        <rect x="150" y="90" width="40" height="30" rx="4" fill="#dde6df" />
        <rect x="220" y="20" width="50" height="34" rx="4" fill="#dde6df" />
        <circle cx="200" cy="100" r="62" fill="#14907e" fillOpacity=".16" stroke="#14907e" strokeWidth="2" strokeDasharray="6 5" />
      </svg>
      <figcaption className="p-4 text-sm">
        <p className="font-semibold">{area}</p>
        <p className="text-muted">Approximate area (within ~{radius} m). Your broker shares the exact meeting point once your visit is confirmed.</p>
      </figcaption>
    </figure>
  );
}
