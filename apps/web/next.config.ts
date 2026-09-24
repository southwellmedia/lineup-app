import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source.
  transpilePackages: ["@lineup/db", "@lineup/scheduling"],
  typedRoutes: true,
};

export default nextConfig;
