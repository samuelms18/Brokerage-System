import { NextResponse, type NextRequest } from "next/server";

// Login wall (D-02): every page needs a session. Signed-out users are sent
// to /login?next=<the page they opened> and returned there after OTP.
// This only checks that a session cookie exists; pages and API handlers
// validate the session itself.
export function middleware(req: NextRequest) {
  if (req.cookies.get("srb_session")?.value) return NextResponse.next();
  const url = req.nextUrl.clone();
  const next = req.nextUrl.pathname + req.nextUrl.search;
  url.pathname = "/login";
  url.search = next === "/" ? "" : `?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|api|media|_next|favicon.ico|icon.svg|manifest.webmanifest).*)"],
};
