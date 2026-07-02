"use client";
import { useEffect, useRef, useCallback, useState } from "react";

// ─── Minimal Web Speech API type shims ──────────────────────────────────────
// The standard lib.dom.d.ts doesn't include these in all TS versions.
interface SpeechRecognitionResultItem {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResultItem[];
  [index: number]: SpeechRecognitionResultItem[];
}
interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

// ────────────────────────────────────────────────────────────────────────────

export interface UseVoiceOptions {
  onTranscript: (transcript: string, detectedLang: "en" | "bn") => void;
  onError?: (error: string) => void;
  onListeningEnd?: () => void;
}

export interface UseVoiceReturn {
  isListening: boolean;
  isSTTSupported: boolean;
  isTTSSupported: boolean;
  startListening: (lang: "en" | "bn") => void;
  stopListening: () => void;
  speak: (text: string, lang: "en" | "bn") => SpeechSynthesisUtterance | null;
  cancelSpeech: () => void;
}

function detectBengali(text: string): boolean {
  return /[ঀ-৿]/.test(text);
}

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useVoice({
  onTranscript,
  onError,
  onListeningEnd,
}: UseVoiceOptions): UseVoiceReturn {
  const [isListening, setIsListening] = useState(false);
  const [isSTTSupported, setIsSTTSupported] = useState(false);
  const [isTTSSupported, setIsTTSSupported] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  // Stable callback refs
  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);
  const onListeningEndRef = useRef(onListeningEnd);
  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => { onListeningEndRef.current = onListeningEnd; }, [onListeningEnd]);

  useEffect(() => {
    const SpeechRec = getSpeechRecognition();
    setIsSTTSupported(!!SpeechRec);
    setIsTTSSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  // Create a fresh SpeechRecognition instance per call so language changes take effect
  const startListening = useCallback((lang: "en" | "bn") => {
    const SpeechRec = getSpeechRecognition();
    if (!SpeechRec) return;

    // Abort any previous instance
    recognitionRef.current?.abort();

    const rec = new SpeechRec();
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.lang = lang === "bn" ? "bn-BD" : "en-US";

    rec.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript.trim();
      const detectedLang = detectBengali(transcript) ? "bn" : "en";
      setIsListening(false);
      onTranscriptRef.current(transcript, detectedLang);
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      setIsListening(false);
      if (event.error !== "no-speech" && event.error !== "aborted") {
        onErrorRef.current?.(event.error);
      }
      onListeningEndRef.current?.();
    };

    rec.onend = () => {
      setIsListening(false);
      onListeningEndRef.current?.();
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      setIsListening(true);
    } catch {
      // Ignore — already started
    }
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const speak = useCallback(
    (text: string, lang: "en" | "bn"): SpeechSynthesisUtterance | null => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === "bn" ? "bn-BD" : "en-US";
      utterance.rate = 0.88;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      window.speechSynthesis.speak(utterance);
      return utterance;
    },
    []
  );

  const cancelSpeech = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  return {
    isListening,
    isSTTSupported,
    isTTSSupported,
    startListening,
    stopListening,
    speak,
    cancelSpeech,
  };
}
