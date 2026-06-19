// Phase 2 helpers: structured metrics & evidence. Metrics are the source of
// truth; the legacy free-text `metrics` string is kept as a derived mirror so
// AI digests (resume bullets, interview answers) and search still read them.
import {
  EVIDENCE_TYPES,
  METRIC_TYPES,
  type Evidence,
  type EvidenceType,
  type Metric,
  type MetricType,
} from "@/lib/types";

// English default label for a metric type (slug → "Time saved"). Used for the
// text mirror that feeds the AI; the UI localizes separately.
export function defaultMetricLabel(type: MetricType): string {
  if (type === "custom") return "Metric";
  return type
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Join structured metrics into the legacy free-text string, e.g.
// "Time saved: 40% (hrs/week); Cost saved: $200k".
export function metricsToText(list: Metric[]): string {
  return list
    .filter((m) => m.value.trim() || m.label.trim())
    .map((m) => {
      const label = m.label.trim() || defaultMetricLabel(m.type);
      const value = [m.value.trim(), m.unit.trim() ? `(${m.unit.trim()})` : ""]
        .filter(Boolean)
        .join(" ");
      return value ? `${label}: ${value}` : label;
    })
    .join("; ");
}

function isMetricType(v: unknown): v is MetricType {
  return typeof v === "string" && (METRIC_TYPES as readonly string[]).includes(v);
}

function isEvidenceType(v: unknown): v is EvidenceType {
  return typeof v === "string" && (EVIDENCE_TYPES as readonly string[]).includes(v);
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

// Sanitize a metrics array from a request body: keep only well-typed rows that
// carry a value or a custom label. Caps the count defensively.
export function readMetricsList(v: unknown): Metric[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((m): Metric | null => {
      const o = (m ?? {}) as Record<string, unknown>;
      const type = isMetricType(o.type) ? o.type : "custom";
      return {
        type,
        label: str(o.label).slice(0, 120),
        value: str(o.value).slice(0, 120),
        unit: str(o.unit).slice(0, 60),
      };
    })
    .filter((m): m is Metric => !!m && (m.value.trim() !== "" || m.label.trim() !== ""))
    .slice(0, 20);
}

// Sanitize an evidence array: keep rows that have a label or a URL.
export function readEvidence(v: unknown): Evidence[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((e): Evidence | null => {
      const o = (e ?? {}) as Record<string, unknown>;
      const type = isEvidenceType(o.type) ? o.type : "url";
      return {
        type,
        label: str(o.label).slice(0, 200),
        url: str(o.url).slice(0, 2000),
      };
    })
    .filter((e): e is Evidence => !!e && (e.label.trim() !== "" || e.url.trim() !== ""))
    .slice(0, 20);
}
