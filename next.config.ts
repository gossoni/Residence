import type { NextConfig } from "next";

const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
