import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["sinavigator.adv.ro"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
