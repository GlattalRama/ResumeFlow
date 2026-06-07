import { Fragment } from "react";
import { parseSummaryToBlocks, type RichRun } from "@/lib/richText";

// Renders a stored rich-text value (constrained HTML or legacy plain text) as
// styled paragraphs and lists. Used by every resume template (preview + PDF) so
// bold, italic, underline, strikethrough, and bullet/numbered lists render
// consistently. Pure component — safe in both server and client rendering.
export default function RichText({
  value,
  className = "",
  blockSpacing = "0.5em",
}: {
  value: string | null | undefined;
  // Applied to every rendered paragraph.
  className?: string;
  // Top margin applied to every block except the first.
  blockSpacing?: string;
}) {
  const blocks = parseSummaryToBlocks(value);
  if (blocks.length === 0) return null;

  return (
    <>
      {blocks.map((block, i) => {
        const style = i > 0 ? { marginTop: blockSpacing } : undefined;
        if (block.type === "paragraph") {
          return (
            <p key={i} className={className} style={style}>
              {block.runs.map(renderRun)}
            </p>
          );
        }
        const ListTag = block.ordered ? "ol" : "ul";
        return (
          <ListTag
            key={i}
            className={`${block.ordered ? "list-decimal" : "list-disc"} pl-5 ${className}`}
            style={style}
          >
            {block.items.map((item, j) => (
              <li key={j}>{item.map(renderRun)}</li>
            ))}
          </ListTag>
        );
      })}
    </>
  );
}

function renderRun(r: RichRun, j: number) {
  let node: React.ReactNode = r.text;
  if (r.strike) node = <s>{node}</s>;
  if (r.underline) node = <u>{node}</u>;
  if (r.italic) node = <em>{node}</em>;
  if (r.bold) node = <strong>{node}</strong>;
  return <Fragment key={j}>{node}</Fragment>;
}
