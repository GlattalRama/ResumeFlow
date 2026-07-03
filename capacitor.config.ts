import type { CapacitorConfig } from '@capacitor/cli';

// Resumeflow-ATS ships as a thin native shell that loads the live SSR site
// (NextAuth, server actions, /api/*) rather than a static bundle. See the
// mobile-app-plan memory. `server.url` points the WebView at production; the
// `webDir` below is only a bundled offline fallback used when the network or
// the site is unreachable.
const config: CapacitorConfig = {
  appId: 'com.resumeflowats.app',
  appName: 'Resumeflow ATS',
  webDir: 'mobile-shell',
  server: {
    url: 'https://resumeflow-ats.com',
    androidScheme: 'https',
    // Keep cleartext off — production is HTTPS-only.
    cleartext: false,
  },
};

export default config;
