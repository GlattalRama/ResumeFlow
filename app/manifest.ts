import type { MetadataRoute } from "next";

// PWA manifest — lets users install Resumeflow-ATS to their home screen and run
// it as a standalone, app-like experience on mobile (no browser chrome).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Resumeflow-ATS",
    short_name: "Resumeflow",
    description:
      "Build ATS-friendly resumes, track job applications, and prep for interviews.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#0033a0",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
