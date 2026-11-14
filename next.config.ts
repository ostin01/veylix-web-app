import type { NextConfig } from "next";

// The backend has no CORS middleware, so the browser talks to Next.js and
// Next.js forwards /api/v1/* and /health to the FastAPI service.
const apiUrl = (process.env.VEYLIX_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/v1/:path*", destination: `${apiUrl}/api/v1/:path*` },
      { source: "/backend-health", destination: `${apiUrl}/health` },
    ];
  },
};

export default nextConfig;
