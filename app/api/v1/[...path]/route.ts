import type { NextRequest } from "next/server";
import { forward } from "@/lib/server/forward";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

async function handler(req: NextRequest, ctx: Ctx) {
  return forward(req, (await ctx.params).path);
}

export { handler as GET, handler as POST, handler as PATCH, handler as PUT, handler as DELETE };
