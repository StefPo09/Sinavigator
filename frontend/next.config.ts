import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep src/pages available for view components without exposing them as routes.
  pageExtensions: ["route.tsx", "route.ts"],
  turbopack: {
    rules: {
      "globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  webpack(config) {
    // Apply the same Tailwind transform when running the production build.
    config.module.rules.unshift({
      test: /[\\/]globals\.css$/,
      enforce: "pre",
      use: [require.resolve("@tailwindcss/turbopack")],
    });
    return config;
  },
};

export default nextConfig;
