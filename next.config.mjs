import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

const __dirname = dirname(fileURLToPath(import.meta.url));

// UI internationalization (cookie-based locale, see i18n/request.ts).
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Headless-Chromium PDF export (app/api/resumes/[id]/pdf) — load these at
  // runtime from node_modules instead of bundling them.
  serverExternalPackages: ["playwright-core", "@sparticuz/chromium"],
  // The tracer misses @sparticuz/chromium's bin/ assets (they're only reached
  // via runtime fs calls), so the deployed function 500s with "input directory
  // .../bin does not exist" — force-include them for the PDF route.
  outputFileTracingIncludes: {
    "/api/resumes/**": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
  // Pin the workspace root so Next.js doesn't infer it from the stray
  // ~/package-lock.json when multiple lockfiles are present.
  outputFileTracingRoot: __dirname,
  webpack: (config, { isServer, webpack }) => {
    // pptxgenjs (used for client-side PPTX export) lazily `import("node:fs")` /
    // `import("node:https")` for its Node file-writing code paths. Those paths
    // are never hit in the browser (we request a Blob), but webpack still tries
    // to resolve the `node:`-scheme specifiers at build time and fails with
    // UnhandledSchemeError. Strip the `node:` prefix and, for the browser
    // bundle, resolve the bare modules to empty stubs.
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
        resource.request = resource.request.replace(/^node:/, "");
      })
    );
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        https: false,
        http: false,
        os: false,
        path: false,
      };
    }
    return config;
  },
};

export default withNextIntl(nextConfig);
