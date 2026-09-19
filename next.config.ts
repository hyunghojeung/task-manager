import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "1gb",
    },
    // 프로그램 배포 파일(zip, ~50MB) 업로드 — middleware 가 요청 본문을 버퍼링하는 상한 (기본 10MB)
    proxyClientMaxBodySize: "250mb",
  },
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
