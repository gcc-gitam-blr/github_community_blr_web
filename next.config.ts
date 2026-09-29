import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray package-lock.json in the parent folder made Next guess the wrong workspace root.
  turbopack: { root: path.resolve(__dirname) },
};

export default nextConfig;
