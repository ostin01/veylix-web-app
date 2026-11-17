import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_COOKIE,
  API_URL,
  REFRESH_COOKIE,
  UpstreamUnavailable,
  clearAuthCookies,
  isSameOrigin,
  refreshTokens,
  resolveAccess,
  setAuthCookies,
  type Tokens,
} from "./session";

// Credentials are exchanged through /api/auth/login and /api/auth/logout only.
const BLOCKED = new Set(["auth/token", "auth/refresh", "auth/logout"]);

function json(status: number, detail: string): NextResponse {
  return NextResponse.json({ detail }, { status, headers: { "cache-control": "no-store" } });
}

async function callApi(url: string, method: string, token: string, body: ArrayBuffer | undefined, contentType: string | null) {
  const headers: Record<string, string> = { authorization: `Bearer ${token}` };
  if (contentType) headers["content-type"] = contentType;
  return fetch(url, { method, headers, body, cache: "no-store", redirect: "manual" });
}

async function isCredentialError(res: Response): Promise<boolean> {
  const body = (await res.clone().json().catch(() => null)) as { detail?: unknown } | null;
  return body?.detail === "Current password is incorrect";
}

async function passthrough(upstream: Response, fresh: Tokens | null, req: NextRequest): Promise<NextResponse> {
  const res = new NextResponse(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: { "cache-control": "no-store", "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
  if (fresh) setAuthCookies(res, req, fresh);
  return res;
}

export async function forward(req: NextRequest, segments: string[]): Promise<NextResponse> {
  const path = segments.join("/");
  if (BLOCKED.has(path)) return json(404, "Not found");
  if (!["GET", "HEAD"].includes(req.method) && !isSameOrigin(req)) return json(403, "Cross-origin request blocked");

  const hadCookies = req.cookies.has(ACCESS_COOKIE) || req.cookies.has(REFRESH_COOKIE);
  const url = `${API_URL}/api/v1/${path}${req.nextUrl.search}`;
  const body = ["GET", "HEAD"].includes(req.method) ? undefined : await req.arrayBuffer();
  const contentType = req.headers.get("content-type");

  let fresh: Tokens | null = null;
  let upstream: Response;
  try {
    const access = await resolveAccess(req);
    fresh = access.fresh;
    if (!access.token) {
      const res = json(401, "Not authenticated");
      if (hadCookies) clearAuthCookies(res);
      return res;
    }
    upstream = await callApi(url, req.method, access.token, body, contentType);

    // The API can reject a token that has not expired yet (password change,
    // deactivation). Try one refresh before giving up.
    const refresh = req.cookies.get(REFRESH_COOKIE)?.value;
    // A wrong current password is also a 401, but it says nothing about the session.
    if (upstream.status === 401 && path === "auth/password" && (await isCredentialError(upstream))) {
      return passthrough(upstream, fresh, req);
    }
    if (upstream.status === 401 && !fresh && refresh) {
      const rotated = await refreshTokens(refresh);
      if (rotated) {
        fresh = rotated;
        upstream = await callApi(url, req.method, rotated.access_token, body, contentType);
      }
    }
  } catch (error) {
    if (error instanceof UpstreamUnavailable || error instanceof TypeError) {
      return json(502, "Cannot reach the Veylix API. Is the backend running?");
    }
    throw error;
  }

  const empty = upstream.status === 204 || upstream.status === 205 || req.method === "HEAD";
  const isEventStream = path === "events/stream" && upstream.headers.get("content-type")?.includes("text/event-stream");
  const headers = new Headers({ "cache-control": "no-store, no-transform" });
  for (const name of ["content-type", "x-accel-buffering"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  const res = new NextResponse(empty ? null : isEventStream ? upstream.body : await upstream.arrayBuffer(), {
    status: upstream.status,
    headers,
  });

  if (upstream.status === 401) {
    clearAuthCookies(res);
  } else if (path === "auth/password" && upstream.ok) {
    // The API revokes every session when the password changes.
    clearAuthCookies(res);
  } else if (fresh) {
    setAuthCookies(res, req, fresh);
  }
  return res;
}
