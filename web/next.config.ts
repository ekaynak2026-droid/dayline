import type { NextConfig } from "next";

// DAYLINE_BASE is the folder the app is served from, e.g. "/dayline/test" for the trial copy.
const basePath = process.env.DAYLINE_BASE ?? "/dayline/test";

const nextConfig: NextConfig = {
  output: "export",          // plain files that GitHub Pages can serve
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_DAYLINE_TEST: process.env.DAYLINE_TEST ?? "1",
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
