import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["postgres", "ws", "@react-pdf/renderer"],
};

export default nextConfig;
