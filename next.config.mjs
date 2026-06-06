import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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

export default nextConfig;
