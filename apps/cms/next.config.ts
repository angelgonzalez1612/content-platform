import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // content-radar es workspace source (.ts sin build propio, igual que
  // @planazo/types) — sin esto Next no sabe transpilar su código real
  // (run.ts/render.ts sí ejecutan en runtime, a diferencia de los tipos).
  transpilePackages: ["@planazo/content-radar"],
};

export default nextConfig;
