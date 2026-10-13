import { currentUser } from "@/lib/server/http";
import { findStudentVisible } from "@/lib/server/listings";
import { propertyPhotoSvg } from "@/lib/server/photo-art";

// Stand-in for signed photo URLs. Only PUBLIC photos of student-visible
// properties are served, and only to signed-in users.
export async function GET(_req: Request, { params }: { params: Promise<{ code: string; file: string }> }) {
  const { code, file } = await params;
  const user = await currentUser();
  const property = findStudentVisible(code);
  const index = Number(file.replace(/\.svg$/, ""));
  const photo = Number.isInteger(index) ? property?.photos[index] : undefined;
  if (!user || !property || !photo || !photo.isPublic) return new Response("Not found", { status: 404 });
  return new Response(propertyPhotoSvg(photo), {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "private, max-age=3600", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'" },
  });
}
