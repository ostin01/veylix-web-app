// Server-only helpers for the cookie-based session. Tokens live in httpOnly
// cookies and never reach browser JavaScript; the Next.js server attaches the
// bearer token when it forwards requests to the Veylix API.
import type { NextRequest, NextResponse } from "next/server";

export const API_URL = (process.env.VEYLIX_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
export const ACCESS_COOKIE = "vx_at";
export const REFRESH_COOKIE = "vx_rt";

export interface Tokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
}

export class UpstreamUnavailable extends Error {}

function isSecure(req: NextRequest): boolean {
  return req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
}

export function setAuthCookies(res: NextResponse, req: NextRequest, tokens: Tokens): void {
  const base = { httpOnly: true, sameSite: "lax" as const, path: "/", secure: isSecure(req) };
  res.cookies.set(ACCESS_COOKIE, tokens.access_token, { ...base, maxAge: tokens.expires_in });
  res.cookies.set(REFRESH_COOKIE, tokens.refresh_token, { ...base, maxAge: tokens.refresh_expires_in });
}

export function clearAuthCookies(res: NextResponse): void {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE]) {
    res.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
}

/** Browsers always send Origin on POST/PATCH/DELETE; reject cross-site ones (CSRF defence in depth on top of SameSite=Lax). */
export function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function expiresSoon(jwt: string): boolean {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1] ?? "", "base64url").toString("utf8"));
    return typeof payload.exp === "number" ? payload.exp * 1000 - Date.now() < 10_000 : false;
  } catch {
    return false;
  }
}

/**
 * Refresh tokens are single-use and the API revokes the whole token family if
 * one is replayed. A page fires several requests at once, so concurrent
 * refreshes with the same cookie must share one upstream call.
 */
const inflight = new Map<string, Promise<Tokens | null>>();

export function refreshTokens(refreshToken: string): Promise<Tokens | null> {
  const existing = inflight.get(refreshToken);
  if (existing) return existing;

  const promise = (async (): Promise<Tokens | null> => {
    let res: Response;
    try {
      res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
        cache: "no-store",
      });
    } catch {
      inflight.delete(refreshToken); // transient: allow a later retry
      throw new UpstreamUnavailable();
    }
    if (res.status >= 500) {
      inflight.delete(refreshToken);
      throw new UpstreamUnavailable();
    }
    return res.ok ? ((await res.json()) as Tokens) : null;
  })();

  inflight.set(refreshToken, promise);
  // Keep the result briefly so requests already in flight with the old cookie reuse it.
  setTimeout(() => inflight.delete(refreshToken), 15_000).unref?.();
  return promise;
}

export interface Access {
  token: string | null;
  /** Set when the tokens were rotated during this request; must be written to cookies. */
  fresh: Tokens | null;
}

export async function resolveAccess(req: NextRequest): Promise<Access> {
  const access = req.cookies.get(ACCESS_COOKIE)?.value;
  if (access && !expiresSoon(access)) return { token: access, fresh: null };
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!refresh) return { token: null, fresh: null };
  const fresh = await refreshTokens(refresh);
  return fresh ? { token: fresh.access_token, fresh } : { token: null, fresh: null };
}
