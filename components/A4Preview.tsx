"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PageMargins } from "@/lib/types";

// Renders resume content as true A4 page sheets — separate white pages with a
// gap between them, like Word's page view or a PDF reader.
//
// Two copies of the content are rendered:
//   • A hidden continuous "flow" copy: the measurement source (spacer heights,
//     page count) and the ONLY copy visible when printing, so the PDF is the
//     same continuous fragmented flow as before.
//   • Visible per-page "slices": each an A4-sized sheet showing its window of
//     the flow via a translateY offset inside an overflow-hidden viewport.
//
// Responsibilities (page geometry lives here, not in the templates):
//   • Sets the A4 width and applies the user's page margins as on-screen padding.
//   • Auto-scales the sheets down to fit the available container width while
//     keeping the true A4 layout — content is laid out at full A4 width and
//     only visually scaled, so pagination stays exact.
//   • Fills forced page breaks: any element the template marks with
//     `data-pb-spacer` is grown so the content after it starts on a new page.
//   • Injects a print stylesheet so the PDF uses the same margins as @page
//     margins (and drops the on-screen scaling/padding/slicing).
//
// Sizing uses the CSS reference of 96dpi (1in = 96px = 25.4mm), so the sheet is
// a true A4 aspect ratio on screen.
const PX_PER_MM = 96 / 25.4;
const A4_WIDTH_PX = Math.round(210 * PX_PER_MM); // ≈ 794px
const A4_HEIGHT_PX = 297 * PX_PER_MM; // ≈ 1122.5px
// Visual gap between page sheets on screen (screen-only, never printed).
const PAGE_GAP_PX = 24;

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
  // Hidden continuous copy: measurement source + print DOM.
  const flowRef = useRef<HTMLDivElement>(null);
  // Visible page slices (each duplicates the children).
  const pagesRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState(1);
  const [spacerHeights, setSpacerHeights] = useState<number[]>([]);
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

  // Measure the hidden flow copy: resolve forced-break spacers top-to-bottom
  // (reading getBoundingClientRect between mutations reflects the new layout
  // synchronously), then derive the page count from the flowed height. All at
  // the unscaled A4 width, so the visual scale never affects measurements.
  useIsomorphicLayoutEffect(() => {
    const el = flowRef.current;
    if (!el) return;

    const recompute = () => {
      const contentTop = el.getBoundingClientRect().top;
      const spacers = Array.from(
        el.querySelectorAll<HTMLElement>("[data-pb-spacer]")
      );
      spacers.forEach((s) => (s.style.height = "0px"));
      const heights: number[] = [];
      for (const spacer of spacers) {
        const y = spacer.getBoundingClientRect().top - contentTop - padTopPx;
        let fill = 0;
        if (y > 0) {
          const rem = y % printablePx;
          fill = rem < 0.5 ? 0 : printablePx - rem;
        }
        spacer.style.height = `${fill}px`;
        heights.push(fill);
      }

      const flowed = el.scrollHeight - padTopPx - padBottomPx;
      let pages = 1;
      while (pages * printablePx < flowed - 0.5) pages++;
      setPageCount(pages);
      setSpacerHeights((prev) =>
        prev.length === heights.length &&
        prev.every((v, i) => v === heights[i])
          ? prev
          : heights
      );
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [padTopPx, padBottomPx, printablePx, children]);

  // Mirror the resolved spacer heights into every visible page slice — the
  // slices are independent renders of the same children, so their spacers
  // exist in the same order as the flow copy's.
  useIsomorphicLayoutEffect(() => {
    const root = pagesRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>("[data-pb-slice]").forEach((slice) => {
      slice
        .querySelectorAll<HTMLElement>("[data-pb-spacer]")
        .forEach((s, i) => {
          s.style.height = `${spacerHeights[i] ?? 0}px`;
        });
    });
  }, [spacerHeights, pageCount]);

  // Track the available width so the sheets can scale to fit it.
  useIsomorphicLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const measure = () => setContainerWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const padding = `${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm`;
  const columnHeight =
    pageCount * A4_HEIGHT_PX + (pageCount - 1) * PAGE_GAP_PX;

  const pageStyle = `@media print {
  @page { margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm; }
  .a4-frame { width: auto !important; height: auto !important; }
  .a4-screen-pages { display: none !important; }
  .a4-print-flow { position: static !important; visibility: visible !important; width: auto !important; padding: 0 !important; }
}`;

  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: pageStyle }} />
      <div ref={outerRef} className="w-full">
        {/* Reserves the scaled footprint so surrounding layout flows correctly. */}
        <div
          className="a4-frame relative mx-auto"
          style={{ width: A4_WIDTH_PX * scale, height: columnHeight * scale }}
        >
          {/* Hidden continuous flow: measurement source and the print DOM.
              visibility:hidden keeps layout (measurable) without painting;
              the print stylesheet makes it the only visible copy on paper. */}
          <div
            ref={flowRef}
            className="a4-print-flow a4-sheet absolute left-0 top-0"
            style={{
              width: A4_WIDTH_PX,
              padding,
              visibility: "hidden",
              pointerEvents: "none",
            }}
          >
            {children}
          </div>

          {/* Screen-only page slices: real separated sheets, like Word. */}
          <div
            ref={pagesRef}
            className="a4-screen-pages absolute left-0 top-0"
            style={{
              width: A4_WIDTH_PX,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            {Array.from({ length: pageCount }, (_, k) => (
              <div
                key={k}
                data-pb-slice
                // The slices repeat the same content; expose only the first
                // to assistive tech to avoid duplicate reading.
                aria-hidden={k > 0 || undefined}
                className="a4-sheet relative overflow-hidden bg-white shadow-md"
                style={{
                  width: A4_WIDTH_PX,
                  height: A4_HEIGHT_PX,
                  marginTop: k === 0 ? 0 : PAGE_GAP_PX,
                }}
              >
                {/* Viewport clipped to this page's printable band; the inner
                    copy keeps the exact flow layout (same padding) and is
                    shifted up so page k's window shows through. */}
                <div
                  className="absolute inset-x-0 overflow-hidden"
                  style={{ top: padTopPx, height: printablePx }}
                >
                  <div
                    style={{
                      width: A4_WIDTH_PX,
                      padding,
                      transform: `translateY(${-(padTopPx + k * printablePx)}px)`,
                    }}
                  >
                    {children}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
