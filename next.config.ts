import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "1gb",
    },
  },
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
