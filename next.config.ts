import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Docker builds need a self-contained server bundle. Left off elsewhere so
  // platform builders (Vercel, Netlify) use their own optimised output.
  ...(process.env.DOCKER_BUILD ? { output: "standalone" as const } : {}),
  serverExternalPackages: ["@prisma/client"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
