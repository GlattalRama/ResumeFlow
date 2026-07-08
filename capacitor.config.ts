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
  // Definitive marker for the app-shell layout: lib/nativeApp.ts matches this
  // token in the User-Agent (with a generic Android-WebView fallback for APKs
  // built before it existed).
  appendUserAgent: 'ResumeflowApp',
  server: {
    // Production: the native shell loads the live HTTPS site. For local device
    // testing, temporarily switch url to 'http://10.0.2.2:3001' (emulator
    // loopback) with androidScheme:'http' + cleartext:true — but do NOT ship
    // that; release builds must point at production over HTTPS.
    url: 'https://resumeflow-ats.com',
    androidScheme: 'https',
    cleartext: false,
  },
};

export default config;
