import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isLoginPage = pathname === "/login";
  const isLoginApi = pathname === "/api/login";
  const isPingApi = pathname === "/api/ping";
  // /api/public/* is the unauthenticated, read-only feed consumed by the
  // marketing site (gamingdojo.co). Routes under it expose GET only.
  const isPublicApi = pathname.startsWith("/api/public/");
  // PWA install assets. Chrome fetches these without our session cookie, so
  // gating them breaks "Add to Home Screen" on the kiosk tablet. Neither the
  // manifest nor the icons expose anything private.
  const isPwaAsset =
    pathname === "/manifest.webmanifest" || pathname.startsWith("/icon-");
  const isPublic =
    isLoginPage || isLoginApi || isPingApi || isPublicApi || isPwaAsset;

  const token = req.cookies.get("gd_auth")?.value;
  const hasSession = Boolean(token);

  if (!hasSession && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  if (hasSession && isLoginPage) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
