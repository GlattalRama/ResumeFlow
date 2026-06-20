import { useCallback, useEffect, useRef, useState } from "react";

// Minimal typings for the Web Speech API (not in the standard DOM lib) — enough
// for dictation, without pulling `any` through the code.
interface SRAlternative {
  transcript: string;
}
interface SRResult {
  0: SRAlternative;
  isFinal: boolean;
  length: number;
}
interface SRResultList {
  length: number;
  [index: number]: SRResult;
}
interface SREvent {
  resultIndex: number;
  results: SRResultList;
}
interface SRErrorEvent {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
}
type SRConstructor = new () => SpeechRecognitionLike;

function getConstructor(): SRConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SRConstructor;
    webkitSpeechRecognition?: SRConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Dictation hook. `onFinal` is called with each finalized transcript chunk so
// the caller can append it wherever it likes (e.g. a textarea). Degrades
// gracefully: `supported` is false when the browser has no Web Speech API.
export function useSpeechToText({
  lang,
  onFinal,
}: {
  lang: string;
  onFinal: (text: string) => void;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recogRef = useRef<SpeechRecognitionLike | null>(null);
  // Keep the latest callback without re-creating the recognizer.
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => {
    setSupported(getConstructor() !== null);
  }, []);

  const stop = useCallback(() => {
    recogRef.current?.stop();
  }, []);

  // Stop dictation on unmount.
  useEffect(() => () => recogRef.current?.abort(), []);

  const start = useCallback(() => {
    const Ctor = getConstructor();
    if (!Ctor || recogRef.current) return;
    const recog = new Ctor();
    recog.lang = lang;
    recog.interimResults = false;
    recog.continuous = true;
    recog.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (text) onFinalRef.current(text);
        }
      }
    };
    recog.onstart = () => {
      setListening(true);
    };
    recog.onerror = (e) => {
      // "no-speech"/"aborted" are routine; surface only real problems.
      if (e.error !== "no-speech" && e.error !== "aborted") setError(e.error);
    };
    recog.onend = () => {
      recogRef.current = null;
      setListening(false);
    };
    setError(null);
    recogRef.current = recog;
    try {
      recog.start();
    } catch (err) {
      // Most often InvalidStateError (already started) — surface it instead of
      // failing silently.
      recogRef.current = null;
      setListening(false);
      setError(err instanceof Error ? err.name : "start-failed");
    }
  }, [lang]);

  return { supported, listening, error, start, stop };
}
