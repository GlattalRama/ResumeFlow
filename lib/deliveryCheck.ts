// Instant, client-side delivery analysis of a practice answer's TEXT — no AI,
// no network, no cost. Catches filler words, vocabulary richness, repetition,
// and run-on sentences. Pace/tone need real audio (a separate feature).

// Per-locale filler words/phrases. Deliberately conservative — only fairly
// unambiguous fillers, to avoid flagging ordinary words.
const FILLERS: Record<string, string[]> = {
  en: ["um", "uh", "er", "erm", "uhh", "hmm", "like", "you know", "i mean", "basically", "literally", "sort of", "kind of"],
  de: ["äh", "ähm", "öh", "hmm", "halt", "quasi", "sozusagen", "irgendwie"],
  fr: ["euh", "ben", "bah", "hum", "du coup", "en fait", "genre", "en gros"],
  it: ["ehm", "uhm", "cioè", "tipo", "praticamente", "diciamo", "insomma"],
  es: ["eh", "este", "esto", "o sea", "en plan", "digamos", "pues"],
};

export interface DeliveryAnalysis {
  wordCount: number;
  fillers: { word: string; count: number }[];
  fillerTotal: number;
  fillerDensity: number; // 0..1 (fillers / words)
  lexicalDiversity: number; // 0..1 (unique / total)
  repeated: { word: string; count: number }[]; // content words used a lot
  sentenceCount: number;
  avgSentenceLength: number; // words per sentence
  longSentences: number; // sentences over 40 words
}

const WORD_RE = /\p{L}+(?:['’]\p{L}+)?/gu;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function analyzeDelivery(text: string, locale: string): DeliveryAnalysis {
  const words = (text.toLowerCase().match(WORD_RE) ?? []) as string[];
  const wordCount = words.length;

  // Fillers: unicode-safe boundaries so accented words aren't split.
  const list = FILLERS[locale] ?? FILLERS.en;
  const fillers: { word: string; count: number }[] = [];
  let fillerTotal = 0;
  for (const f of list) {
    const re = new RegExp(`(?<!\\p{L})${escapeRe(f)}(?!\\p{L})`, "giu");
    const n = (text.match(re) ?? []).length;
    if (n > 0) {
      fillers.push({ word: f, count: n });
      fillerTotal += n;
    }
  }
  fillers.sort((a, b) => b.count - a.count);

  const unique = new Set(words).size;
  const lexicalDiversity = wordCount ? unique / wordCount : 0;

  // Repeated content words: length >= 4 (drops most stopwords across languages),
  // used 3+ times. Top 5.
  const counts = new Map<string, number>();
  for (const w of words) if (w.length >= 4) counts.set(w, (counts.get(w) ?? 0) + 1);
  const repeated = [...counts.entries()]
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word, count]) => ({ word, count }));

  const sentences = text
    .split(/[.!?…]+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const sentenceCount = sentences.length;
  const avgSentenceLength = sentenceCount ? wordCount / sentenceCount : 0;
  const longSentences = sentences.filter((s) => (s.match(WORD_RE) ?? []).length > 40).length;

  return {
    wordCount,
    fillers,
    fillerTotal,
    fillerDensity: wordCount ? fillerTotal / wordCount : 0,
    lexicalDiversity,
    repeated,
    sentenceCount,
    avgSentenceLength,
    longSentences,
  };
}
