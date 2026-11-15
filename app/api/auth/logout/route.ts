import { NextRequest, NextResponse } from "next/server";
import { API_URL, REFRESH_COOKIE, clearAuthCookies, isSameOrigin } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ detail: "Cross-origin request blocked" }, { status: 403 });

  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;
  if (refresh) {
    // Best effort: revoke the refresh token upstream, but always clear the cookies.
    await fetch(`${API_URL}/api/v1/auth/logout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
      cache: "no-store",
    }).catch(() => undefined);
  }
  const res = new NextResponse(null, { status: 204, headers: { "cache-control": "no-store" } });
  clearAuthCookies(res);
  return res;
}
