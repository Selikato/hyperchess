import type { NextConfig } from "next";

const fromEnv =
  process.env.NEXT_ALLOWED_DEV_ORIGINS?.split(",")
    .map((h) => h.trim())
    .filter(Boolean) ?? [];

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    ...new Set([
      "localhost",
      "127.0.0.1",
      "192.168.1.105",
      "192.168.1.146",
      ...fromEnv,
    ]),
  ],
};

export default nextConfig;
