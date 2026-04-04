import { NextResponse } from "next/server";
import {
  ACCESS_COOKIE_NAME,
  createAccessToken,
  getAccessCookieOptions,
  getSharedPasswordConfig,
  normalizeReturnTo,
} from "@/lib/server/access-gate";

function buildErrorRedirect(request: Request, returnTo: string, error: string) {
  const redirectUrl = new URL("/unlock", request.url);
  redirectUrl.searchParams.set("error", error);
  if (returnTo !== "/") {
    redirectUrl.searchParams.set("returnTo", returnTo);
  }
  return NextResponse.redirect(redirectUrl, 303);
}

export async function POST(request: Request) {
  const config = getSharedPasswordConfig();
  if (!config) {
    return buildErrorRedirect(request, "/", "config");
  }

  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  const returnTo = normalizeReturnTo(String(formData.get("returnTo") ?? "/"));

  if (password !== config.password) {
    return buildErrorRedirect(request, returnTo, "invalid");
  }

  const token = await createAccessToken(config.secret);
  const redirectUrl = new URL(returnTo, request.url);
  const response = NextResponse.redirect(redirectUrl, 303);
  response.cookies.set(ACCESS_COOKIE_NAME, token, getAccessCookieOptions());
  return response;
}
