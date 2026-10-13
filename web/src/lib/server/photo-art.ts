import type { Photo } from "./model";

// Placeholder artwork standing in for real photos in the prototype.
export function propertyPhotoSvg(photo: Photo): string {
  const h = photo.hue;
  const bg1 = `hsl(${h} 45% 88%)`;
  const bg2 = `hsl(${(h + 30) % 360} 40% 76%)`;
  const ink = `hsl(${h} 30% 32%)`;
  const soft = `hsl(${h} 35% 60%)`;
  const scenes: Record<Photo["scene"], string> = {
    room: `<rect x="70" y="250" width="300" height="90" rx="12" fill="${soft}"/>
           <rect x="80" y="225" width="90" height="40" rx="10" fill="#fff" opacity=".85"/>
           <rect x="430" y="110" width="150" height="120" rx="6" fill="#fff" opacity=".7"/>
           <line x1="505" y1="110" x2="505" y2="230" stroke="${ink}" stroke-width="4" opacity=".4"/>
           <rect x="430" y="250" width="120" height="110" rx="6" fill="${ink}" opacity=".55"/>`,
    common: `<rect x="80" y="230" width="480" height="24" rx="6" fill="${ink}" opacity=".7"/>
             <rect x="100" y="254" width="12" height="90" fill="${ink}" opacity=".6"/>
             <rect x="528" y="254" width="12" height="90" fill="${ink}" opacity=".6"/>
             <rect x="140" y="110" width="140" height="100" rx="6" fill="#fff" opacity=".7"/>
             <rect x="360" y="110" width="140" height="100" rx="6" fill="#fff" opacity=".7"/>`,
    kitchen: `<rect x="60" y="230" width="520" height="110" rx="8" fill="${soft}"/>
              <rect x="60" y="215" width="520" height="20" rx="6" fill="${ink}" opacity=".6"/>
              <rect x="90" y="90" width="180" height="80" rx="6" fill="#fff" opacity=".75"/>
              <circle cx="420" cy="200" r="16" fill="${ink}" opacity=".5"/><circle cx="470" cy="200" r="16" fill="${ink}" opacity=".5"/>`,
    building: `<rect x="180" y="110" width="280" height="250" rx="6" fill="${soft}"/>
               <polygon points="160,120 320,40 480,120" fill="${ink}" opacity=".7"/>
               <rect x="290" y="270" width="60" height="90" rx="4" fill="${ink}" opacity=".7"/>
               <rect x="215" y="160" width="60" height="50" rx="4" fill="#fff" opacity=".8"/>
               <rect x="365" y="160" width="60" height="50" rx="4" fill="#fff" opacity=".8"/>`,
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" role="img" aria-label="${escapeXml(photo.caption)}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient></defs>
  <rect width="640" height="400" fill="url(#g)"/>
  <rect y="340" width="640" height="60" fill="${ink}" opacity=".12"/>
  ${scenes[photo.scene]}
</svg>`;
}

function escapeXml(s: string) {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
}
