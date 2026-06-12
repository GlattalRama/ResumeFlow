"use client";

import { useEffect, useRef } from "react";
import { sanitizeSummaryHtml } from "@/lib/richText";

// A small contentEditable rich-text editor supporting paragraphs, bold, italic,
// underline, strikethrough, and (optionally) bullet/numbered lists. Emits a
// sanitized, constrained-HTML string via onChange. While the user types it is
// the source of truth (we don't rewrite the DOM, which would reset the caret),
// but it re-syncs when `value` changes externally (e.g. a list is reordered).
export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  className = "",
  showLists = true,
  hint = "Enter for a new paragraph",
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  showLists?: boolean;
  hint?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // The last value we emitted, so we can tell self-edits (skip) from external
  // value changes (re-sync the DOM).
  const lastEmitted = useRef<string | null>(null);

  // Initialize content once from the incoming value and prefer tag-based
  // formatting (<b>/<i>) + <p> paragraphs over inline-CSS spans.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const html = sanitizeSummaryHtml(value);
    el.innerHTML = html;
    lastEmitted.current = html;
    try {
      document.execCommand("styleWithCSS", false, "false");
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch {
      // Older browsers may not support these flags; formatting still works.
    }
    // Initialize once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-sync when `value` changes from outside (not from our own onChange), e.g.
  // when the parent reorders or removes an item that shares this component slot.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const incoming = sanitizeSummaryHtml(value);
    if (incoming === lastEmitted.current) return; // our own edit — ignore
    if (incoming === sanitizeSummaryHtml(el.innerHTML)) return; // already in sync
    el.innerHTML = incoming;
    lastEmitted.current = incoming;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function emit() {
    const el = ref.current;
    if (!el) return;
    const html = sanitizeSummaryHtml(el.innerHTML);
    lastEmitted.current = html;
    onChange(html);
  }

  function format(
    cmd:
      | "bold"
      | "italic"
      | "underline"
      | "strikeThrough"
      | "insertUnorderedList"
      | "insertOrderedList"
  ) {
    document.execCommand(cmd, false);
    ref.current?.focus();
    emit();
  }

  const isEmpty = sanitizeSummaryHtml(value) === "";

  return (
    <div
      className={`rounded-md border border-input bg-card text-foreground focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500 ${className}`}
    >
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-1.5 py-1">
        <ToolbarButton label="Bold (Ctrl/Cmd+B)" onClick={() => format("bold")}>
          <span className="font-bold">B</span>
        </ToolbarButton>
        <ToolbarButton label="Italic (Ctrl/Cmd+I)" onClick={() => format("italic")}>
          <span className="font-serif italic">I</span>
        </ToolbarButton>
        <ToolbarButton
          label="Underline (Ctrl/Cmd+U)"
          onClick={() => format("underline")}
        >
          <span className="underline">U</span>
        </ToolbarButton>
        <ToolbarButton label="Strikethrough" onClick={() => format("strikeThrough")}>
          <span className="line-through">S</span>
        </ToolbarButton>
        {showLists && (
          <>
            <span className="mx-1 h-4 w-px bg-muted" aria-hidden="true" />
            <ToolbarButton
              label="Bulleted list"
              onClick={() => format("insertUnorderedList")}
            >
              <ListIcon ordered={false} />
            </ToolbarButton>
            <ToolbarButton
              label="Numbered list"
              onClick={() => format("insertOrderedList")}
            >
              <ListIcon ordered />
            </ToolbarButton>
          </>
        )}
        {hint && (
          <span className="ml-1 text-[11px] text-muted-foreground/70">{hint}</span>
        )}
      </div>
      <div className="relative">
        {isEmpty && placeholder && (
          <span className="pointer-events-none absolute left-3 top-2 text-sm text-muted-foreground/70">
            {placeholder}
          </span>
        )}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Professional summary"
          onInput={emit}
          onBlur={emit}
          className="rf-richtext min-h-[7rem] w-full px-3 py-2 text-sm leading-relaxed focus:outline-none"
        />
      </div>
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      // Prevent the button from stealing focus / clearing the selection so the
      // formatting command applies to the current selection.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded text-sm text-muted-foreground transition hover:bg-muted"
    >
      {children}
    </button>
  );
}

function ListIcon({ ordered }: { ordered: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M9 6h11M9 12h11M9 18h11" />
      {ordered ? (
        <>
          <path d="M4 6h1v3M4 9h2" strokeWidth={1.4} />
          <path d="M4 15.5h2v1.2L4 18.5h2" strokeWidth={1.4} />
        </>
      ) : (
        <>
          <circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none" />
          <circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none" />
        </>
      )}
    </svg>
  );
}
