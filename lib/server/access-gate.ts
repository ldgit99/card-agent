const ACCESS_PAYLOAD = "shared-password-access";

export const ACCESS_COOKIE_NAME = "card_agent_access";
export const ACCESS_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
export const ACCESS_UNLOCK_PATH = "/unlock";

type SharedPasswordConfig = {
  password: string;
  secret: string;
};

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function signValue(value: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return base64UrlEncode(new Uint8Array(signature));
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return diff === 0;
}

export function getSharedPasswordConfig(): SharedPasswordConfig | null {
  const password = process.env.APP_SHARED_PASSWORD;
  const secret = process.env.APP_SESSION_SECRET;

  if (!password || !secret) {
    return null;
  }

  return { password, secret };
}

export function getAccessCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ACCESS_COOKIE_MAX_AGE,
  };
}

export async function createAccessToken(secret: string): Promise<string> {
  const signature = await signValue(ACCESS_PAYLOAD, secret);
  return `${ACCESS_PAYLOAD}.${signature}`;
}

export async function verifyAccessToken(
  token: string | null | undefined,
  secret: string,
): Promise<boolean> {
  if (!token) {
    return false;
  }

  const [value, signature, extra] = token.split(".");
  if (!value || !signature || extra) {
    return false;
  }

  if (value !== ACCESS_PAYLOAD) {
    return false;
  }

  const expectedSignature = await signValue(value, secret);
  return safeEqual(signature, expectedSignature);
}

export function normalizeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  if (value.startsWith(ACCESS_UNLOCK_PATH) || value.startsWith("/api/access")) {
    return "/";
  }

  return value;
}
