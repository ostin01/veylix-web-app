import type { NextConfig } from "next";

// The backend has no CORS middleware, so the browser talks to Next.js.
const apiUrl = (process.env.VEYLIX_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/backend-health", destination: `${apiUrl}/health` },
    ];
  },
};

export default nextConfig;
