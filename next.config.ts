import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Keep this checkout independent of any parent workspace's lockfile.
  turbopack: { root: process.cwd() },
};

export default nextConfig;
