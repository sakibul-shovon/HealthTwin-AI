"use client";
import { useEffect, useRef, useCallback, useState } from "react";

// ─── Minimal Web Speech API type shims ──────────────────────────────────────
interface SpeechRecognitionResultItem { transcript: string; confidence: number; }
interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResultItem[];
  [index: number]: SpeechRecognitionResultItem[];
}
interface SpeechRecognitionEvent extends Event { readonly results: SpeechRecognitionResultList; }
interface SpeechRecognitionErrorEvent extends Event { readonly error: string; }
interface SpeechRecognitionInstance extends EventTarget {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
interface SpeechRecognitionConstructor { new(): SpeechRecognitionInstance; }
// ────────────────────────────────────────────────────────────────────────────

// ─── Web Speech fallback voice cache ────────────────────────────────────────
// Used when the TTS server is unreachable (e.g. Docker not running locally).
const FEMALE_VOICE_PRIORITY = [
  "Google UK English Female",
  "Google US English",
  "Microsoft Aria Online (Natural) - English (United States)",
  "Microsoft Jenny Online (Natural) - English (United States)",
  "Samantha", "Karen", "Victoria",
  "Microsoft Zira Desktop - English (United States)",
];

let cachedFemaleVoice: SpeechSynthesisVoice | null = null;

function pickFemaleVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  for (const name of FEMALE_VOICE_PRIORITY) {
    const v = voices.find((x) => x.name === name);
    if (v) return v;
  }
  return (
    voices.find((v) => v.lang.startsWith("en") && !v.localService) ??
    voices.find((v) => v.lang.startsWith("en-")) ??
    null
  );
}

function initVoiceCache() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const pick = () => { cachedFemaleVoice = pickFemaleVoice() ?? cachedFemaleVoice; };
  pick();
  window.speechSynthesis.addEventListener("voiceschanged", pick);
}
if (typeof window !== "undefined") initVoiceCache();

function safeSynth(utterance: SpeechSynthesisUtterance) {
  window.speechSynthesis.cancel();
  if (window.speechSynthesis.paused) window.speechSynthesis.resume();
  setTimeout(() => window.speechSynthesis.speak(utterance), 80);
}
// ────────────────────────────────────────────────────────────────────────────

/** Minimal handle returned by speak() */
export interface SpeechHandle {
  onend: ((ev: Event) => void) | null;
}

export interface UseVoiceOptions {
  onTranscript: (transcript: string, detectedLang: "en" | "bn") => void;
  onError?: (error: string) => void;
  onListeningEnd?: () => void;
  voiceEnabled?: boolean;
}

export interface UseVoiceReturn {
  isListening: boolean;
  isSTTSupported: boolean;
  isTTSSupported: boolean;
  startListening: (lang: "en" | "bn") => void;
  stopListening: () => void;
  speak: (text: string, lang: "en" | "bn") => SpeechHandle | null;
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
  const [isListening, setIsListening]       = useState(false);
  const [isSTTSupported, setIsSTTSupported] = useState(false);
  const [isTTSSupported, setIsTTSSupported] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const genRef         = useRef(0);          // invalidates in-flight audio on cancel
  const audioCtxRef    = useRef<AudioContext | null>(null);

  const onTranscriptRef   = useRef(onTranscript);
  const onErrorRef        = useRef(onError);
  const onListeningEndRef = useRef(onListeningEnd);
  useEffect(() => { onTranscriptRef.current   = onTranscript; }, [onTranscript]);
  useEffect(() => { onErrorRef.current        = onError; },      [onError]);
  useEffect(() => { onListeningEndRef.current = onListeningEnd; }, [onListeningEnd]);

  useEffect(() => {
    setIsSTTSupported(!!getSpeechRecognition());
    setIsTTSSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  const startListening = useCallback((lang: "en" | "bn") => {
    const SpeechRec = getSpeechRecognition();
    if (!SpeechRec) return;
    recognitionRef.current?.abort();

    const rec = new SpeechRec();
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.lang = lang === "bn" ? "bn-BD" : "en-US";

    rec.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript.trim();
      setIsListening(false);
      onTranscriptRef.current(transcript, detectBengali(transcript) ? "bn" : "en");
    };
    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      setIsListening(false);
      if (event.error !== "no-speech" && event.error !== "aborted")
        onErrorRef.current?.(event.error);
      onListeningEndRef.current?.();
    };
    rec.onend = () => { setIsListening(false); onListeningEndRef.current?.(); };

    recognitionRef.current = rec;
    try { rec.start(); setIsListening(true); } catch { /* already started */ }
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const speak = useCallback(
    (text: string, lang: "en" | "bn"): SpeechHandle | null => {
      if (typeof window === "undefined") return null;

      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
      const gen = ++genRef.current;

      // ── Bengali: Web Speech only (Kokoro doesn't support Bengali) ─────────
      if (lang === "bn") {
        if (!("speechSynthesis" in window)) return null;
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "bn-BD"; u.rate = 0.88;
        safeSynth(u);
        return u as unknown as SpeechHandle;
      }

      // ── English: server-side Kokoro TTS → Web Speech fallback ─────────────
      const handle: SpeechHandle = { onend: null };

      (async () => {
        try {
          if (genRef.current !== gen) return;

          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, voice: "af_bella", speed: 1.0 }),
            signal: AbortSignal.timeout(12_000),
          });

          if (!res.ok) throw new Error(`TTS ${res.status}`);

          const arrayBuf = await res.arrayBuffer();
          if (genRef.current !== gen) return;

          const ctx = new AudioContext({ sampleRate: 24_000 });
          if (ctx.state === "suspended") await ctx.resume();
          audioCtxRef.current = ctx;

          const audioBuf = await ctx.decodeAudioData(arrayBuf);
          if (genRef.current !== gen) { ctx.close(); return; }

          const src = ctx.createBufferSource();
          src.buffer = audioBuf;
          src.connect(ctx.destination);
          src.start(0);
          src.onended = () => {
            if (genRef.current === gen) handle.onend?.(new Event("end"));
          };
        } catch {
          // Server unavailable (Docker not running, network error, etc.)
          // → fall back to the best available browser voice
          if (genRef.current !== gen || !("speechSynthesis" in window)) return;
          const u = new SpeechSynthesisUtterance(text);
          u.lang = "en-GB"; u.rate = 0.92; u.pitch = 1.05;
          const v = cachedFemaleVoice ?? pickFemaleVoice();
          if (v) u.voice = v;
          u.onend = () => { if (genRef.current === gen) handle.onend?.(new Event("end")); };
          safeSynth(u);
        }
      })();

      return handle;
    },
    []
  );

  const cancelSpeech = useCallback(() => {
    genRef.current++;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    }
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }, []);

  return { isListening, isSTTSupported, isTTSSupported, startListening, stopListening, speak, cancelSpeech };
}
