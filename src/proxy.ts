import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ACCESS_COOKIE_NAME,
  ACCESS_UNLOCK_PATH,
  getSharedPasswordConfig,
  normalizeReturnTo,
  verifyAccessToken,
} from "@/lib/server/access-gate";

function isApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

function isPublicPath(pathname: string): boolean {
  return pathname === ACCESS_UNLOCK_PATH || pathname.startsWith("/api/access");
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const config = getSharedPasswordConfig();
  if (!config) {
    if (isApiPath(pathname)) {
      return NextResponse.json({ error: "access gate is not configured" }, { status: 503 });
    }

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = ACCESS_UNLOCK_PATH;
    redirectUrl.search = "?error=config";
    return NextResponse.redirect(redirectUrl);
  }

  const token = request.cookies.get(ACCESS_COOKIE_NAME)?.value;
  if (await verifyAccessToken(token, config.secret)) {
    return NextResponse.next();
  }

  if (isApiPath(pathname)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = ACCESS_UNLOCK_PATH;
  redirectUrl.searchParams.set("returnTo", normalizeReturnTo(`${pathname}${search}`));
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/", "/simulation/:path*", "/report/:path*", "/api/:path*"],
};
