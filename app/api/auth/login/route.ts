import { NextRequest, NextResponse } from "next/server";
import { API_URL, isSameOrigin, setAuthCookies, type Tokens } from "@/lib/server/session";

export const dynamic = "force-dynamic";

function fail(status: number, detail: unknown) {
  return NextResponse.json({ detail }, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return fail(403, "Cross-origin request blocked");

  let credentials: { username?: unknown; password?: unknown };
  try {
    credentials = await req.json();
  } catch {
    return fail(400, "Invalid request body");
  }

  let tokenRes: Response;
  try {
    tokenRes = await fetch(`${API_URL}/api/v1/auth/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: credentials.username, password: credentials.password }),
      cache: "no-store",
    });
  } catch {
    return fail(502, "Cannot reach the Veylix API. Is the backend running?");
  }

  if (!tokenRes.ok) {
    const body = await tokenRes.json().catch(() => ({}));
    return fail(tokenRes.status, body.detail ?? "Sign-in failed");
  }

  const tokens = (await tokenRes.json()) as Tokens;
  const meRes = await fetch(`${API_URL}/api/v1/auth/me`, {
    headers: { authorization: `Bearer ${tokens.access_token}` },
    cache: "no-store",
  }).catch(() => null);
  if (!meRes?.ok) return fail(502, "Signed in, but could not load the account");

  const res = NextResponse.json({ user: await meRes.json() }, { headers: { "cache-control": "no-store" } });
  setAuthCookies(res, req, tokens);
  return res;
}
