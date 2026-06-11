"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PageMargins } from "@/lib/types";

// Renders resume content as an A4 sheet and overlays dashed page-break guide
// lines at each A4 page boundary so the user can see where the document splits
// when printed / exported to PDF.
//
// Responsibilities (page geometry lives here, not in the templates):
//   • Sets the A4 width and applies the user's page margins as on-screen padding.
//   • Auto-scales the sheet down to fit the available container width (so the
//     whole page is visible) while keeping the true A4 layout — content is laid
//     out at full A4 width and only visually scaled, so pagination stays exact.
//   • Draws a guide line + "Page N" label at every page boundary.
//   • Fills forced page breaks: any element the template marks with
//     `data-pb-spacer` is grown so the content after it starts on a new page.
//   • Injects a print stylesheet so the PDF uses the same margins as @page
//     margins (and drops the on-screen scaling/padding).
//
// Sizing uses the CSS reference of 96dpi (1in = 96px = 25.4mm), so the sheet is
// a true A4 aspect ratio on screen. Guides + spacers are screen-only — they
// never appear in the printed/PDF output.
const PX_PER_MM = 96 / 25.4;
const A4_WIDTH_PX = Math.round(210 * PX_PER_MM); // ≈ 794px
const A4_HEIGHT_PX = 297 * PX_PER_MM; // ≈ 1122.5px

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function A4Preview({
  margins,
  zoom = 1,
  children,
}: {
  margins: PageMargins;
  // Extra magnification applied on top of the auto fit-to-width scale. 1 = fit
  // the container exactly; >1 zooms in (the parent should allow scroll/pan).
  zoom?: number;
  children: React.ReactNode;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<number[]>([]);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  const padTopPx = margins.top * PX_PER_MM;
  const padBottomPx = margins.bottom * PX_PER_MM;
  // Height available for content on each printed page (A4 minus top+bottom).
  const printablePx = Math.max(1, A4_HEIGHT_PX - padTopPx - padBottomPx);
  // Scale the full-width sheet down to fit narrow containers (never up), then
  // apply any user zoom on top.
  const fitScale =
    containerWidth > 0 ? Math.min(1, containerWidth / A4_WIDTH_PX) : 1;
  const scale = fitScale * zoom;

  // Recompute forced-break spacers + page-break guide lines + sheet height.
  // Reading getBoundingClientRect between mutations reflects the new layout
  // synchronously, so spacers can be resolved top-to-bottom in one pass. This
  // all happens at the unscaled A4 width, so the transform scale never affects
  // the measurements.
  useIsomorphicLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const recompute = () => {
      const contentTop = el.getBoundingClientRect().top;
      const spacers = Array.from(
        el.querySelectorAll<HTMLElement>("[data-pb-spacer]")
      );
      spacers.forEach((s) => (s.style.height = "0px"));
      for (const spacer of spacers) {
        const y = spacer.getBoundingClientRect().top - contentTop - padTopPx;
        if (y <= 0) continue;
        const rem = y % printablePx;
        const fill = rem < 0.5 ? 0 : printablePx - rem;
        spacer.style.height = `${fill}px`;
      }

      const flowed = el.scrollHeight - padTopPx - padBottomPx;
      const next: number[] = [];
      for (let k = 1; k * printablePx < flowed - 0.5; k++) {
        next.push(padTopPx + k * printablePx);
      }
      setLines((prev) =>
        prev.length === next.length && prev.every((v, i) => v === next[i])
          ? prev
          : next
      );
      setSheetHeight(el.offsetHeight);
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [padTopPx, padBottomPx, printablePx, children]);

  // Track the available width so the sheet can scale to fit it.
  useIsomorphicLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const measure = () => setContainerWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pageStyle = `@media print {
  @page { margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm; }
  .a4-frame { width: auto !important; height: auto !important; }
  .a4-sheet { position: static !important; transform: none !important; width: auto !important; box-shadow: none !important; }
  .a4-sheet-content { padding: 0 !important; }
}`;

  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: pageStyle }} />
      <div ref={outerRef} className="w-full">
        {/* Reserves the scaled footprint so surrounding layout flows correctly. */}
        <div
          className="a4-frame relative mx-auto"
          style={{ width: A4_WIDTH_PX * scale, height: sheetHeight * scale }}
        >
          <div
            className="a4-sheet absolute left-0 top-0 bg-white shadow-sm"
            style={{
              width: A4_WIDTH_PX,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <div
              ref={contentRef}
              className="a4-sheet-content relative"
              style={{
                padding: `${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm`,
              }}
            >
              {children}

              {lines.map((top, i) => (
                <div
                  key={i}
                  aria-hidden
                  className="pointer-events-none absolute z-10 print:hidden"
                  style={{
                    top,
                    left: -margins.left * PX_PER_MM,
                    right: -margins.right * PX_PER_MM,
                  }}
                >
                  <div className="border-t-2 border-dashed border-red-400/70" />
                  <span className="absolute -top-[9px] right-1 rounded-sm bg-red-400 px-1 text-[9px] font-medium leading-tight text-white">
                    Page {i + 2}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
