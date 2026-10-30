import type { NextConfig } from "next";

// DAYLINE_BASE is the folder the app is served from ("/dayline" on GitHub Pages).
// DAYLINE_TEST=1 builds the separate test copy (own data); the default is the real app.
const basePath = process.env.DAYLINE_BASE ?? "/dayline";

const nextConfig: NextConfig = {
  output: "export",          // plain files that GitHub Pages can serve
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_DAYLINE_TEST: process.env.DAYLINE_TEST ?? "0",
  },
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
