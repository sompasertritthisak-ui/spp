import type { NextConfig } from "next";

// GitHub Pages serves project sites from /<repo>/. CI sets NEXT_PUBLIC_BASE_PATH;
// with a custom domain (or locally) it stays empty.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const config: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
};

export default config;
