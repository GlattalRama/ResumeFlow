"use client";

// File "downloads" inside the Capacitor shells.
//
// Neither Android WebView nor WKWebView handles the web download paths we use:
// window.print() is a silent no-op and blob-URL <a download> clicks go
// nowhere. So on native we write the file to the app cache with the
// Filesystem plugin and hand it to the OS share sheet (Share plugin), where
// the user can save it to Files/Drive, attach it to a mail, etc.
//
// Like lib/nativeReview.ts, this talks to the plugins through the injected
// `window.Capacitor` bridge instead of importing the packages, so the web
// build has no dependency on them. Every helper degrades gracefully: on the
// web — or in an app build that predates the plugins — callers fall back to
// their existing web path.

/* eslint-disable @typescript-eslint/no-explicit-any */

type Capacitorish = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: Record<string, any>;
};

function capacitor(): Capacitorish | undefined {
  return (globalThis as any).Capacitor as Capacitorish | undefined;
}

// True when running inside the Capacitor shell (iOS or Android).
export function isNativeShell(): boolean {
  return capacitor()?.isNativePlatform?.() === true;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      // "data:<mime>;base64,AAAA..." → strip the prefix.
      const dataUrl = String(reader.result);
      resolve(dataUrl.slice(dataUrl.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });
}

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

function mimeFor(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf(".") + 1).toLowerCase();
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

// Delivers an exported file to the user on native.
//
// Android (app builds with DownloadNotifierPlugin, device on Android 10+,
// notifications allowed): saves into the public Downloads folder and posts a
// download-complete notification that opens the file — the closest thing to a
// real browser download a WebView shell can offer.
//
// Everywhere else (iOS always; Android when the plugin is missing, the user
// denied notifications, or the save fails): writes to the app cache and opens
// the OS share sheet, where the user picks a destination.
//
// Returns false when the bridge or plugins are unavailable (web, or an old
// app build) so the caller can fall back to its web download path; throws on
// a real failure so the caller can surface an error.
export async function saveAndShareNative(
  blob: Blob,
  filename: string
): Promise<boolean> {
  const cap = capacitor();
  if (cap?.isNativePlatform?.() !== true) return false;
  if (cap.getPlatform?.() === "android") {
    const notifier = cap.Plugins?.DownloadNotifier;
    if (typeof notifier?.save === "function") {
      try {
        await notifier.save({
          fileName: filename,
          mimeType: mimeFor(filename),
          data: await blobToBase64(blob),
        });
        return true;
      } catch {
        // Pre-Android-10, notification permission denied, or MediaStore
        // failure — fall through to the share-sheet path below.
      }
    }
  }
  const fs = cap.Plugins?.Filesystem;
  const share = cap.Plugins?.Share;
  if (
    typeof fs?.writeFile !== "function" ||
    typeof share?.share !== "function"
  ) {
    return false;
  }

  const data = await blobToBase64(blob);
  const written = await fs.writeFile({
    path: filename,
    data,
    directory: "CACHE",
  });
  try {
    await share.share({ title: filename, url: written.uri });
  } catch (err: any) {
    // The user dismissing the share sheet rejects on some platforms — that's
    // a cancel, not a failure.
    const msg = String(err?.message ?? err).toLowerCase();
    if (!msg.includes("cancel")) throw err;
  }
  return true;
}
