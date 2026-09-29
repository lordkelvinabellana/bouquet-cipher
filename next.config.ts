import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Development only: lets a phone on the same Wi-Fi load the dev server by this machine's
  // address, whichever one the router hands out (or its .local name).
  allowedDevOrigins: ["192.168.*.*", "*.local"],
};

export default nextConfig;
