"use client";
import { useEffect, useRef, useCallback, useState } from "react";

// ─── Minimal Web Speech API type shims ──────────────────────────────────────
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

// ─── Kokoro singleton ────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let kokoroPromise: Promise<any> | null = null;
let kokoroReady = false; // true once the model is fully loaded

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadKokoro(): Promise<any> {
  if (!kokoroPromise) {
    kokoroPromise = (async () => {
      const { KokoroTTS } = await import("kokoro-js");
      let tts;
      try {
        tts = await KokoroTTS.from_pretrained(
          "onnx-community/Kokoro-82M-v1.0-ONNX",
          { dtype: "q8", device: "webgpu" }
        );
      } catch {
        tts = await KokoroTTS.from_pretrained(
          "onnx-community/Kokoro-82M-v1.0-ONNX",
          { dtype: "q8", device: "wasm" }
        );
      }
      kokoroReady = true;
      return tts;
    })().catch((err) => {
      kokoroPromise = null; // allow retry next time
      throw err;
    });
  }
  return kokoroPromise;
}

function safeSynth(utterance: SpeechSynthesisUtterance) {
  // Chrome bug: synthesis silently stalls after async network calls.
  // Cancel + resume + small delay before speaking fixes it reliably.
  window.speechSynthesis.cancel();
  if (window.speechSynthesis.paused) window.speechSynthesis.resume();
  setTimeout(() => window.speechSynthesis.speak(utterance), 80);
}
// ────────────────────────────────────────────────────────────────────────────

/** Minimal handle returned by speak() — callers only use .onend */
export interface SpeechHandle {
  onend: ((ev: Event) => void) | null;
}

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
  const [isListening, setIsListening] = useState(false);
  const [isSTTSupported, setIsSTTSupported] = useState(false);
  const [isTTSSupported, setIsTTSSupported] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  // Generation counter — each new speak()/cancelSpeech() increments this.
  // Async Kokoro closures bail out when they see a stale generation.
  const genRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Stable callback refs so the recognition handlers never go stale
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

    // Warm Kokoro in background immediately — so by the time the user
    // gets their first response the model might already be cached.
    if (typeof window !== "undefined") loadKokoro().catch(() => {});
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
      // Already started — ignore
    }
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const speak = useCallback(
    (text: string, lang: "en" | "bn"): SpeechHandle | null => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;

      // Stop anything currently playing
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
      const gen = ++genRef.current;

      // ── Bengali: always Web Speech API ──────────────────────────────────
      if (lang === "bn") {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "bn-BD";
        utterance.rate = 0.88;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        safeSynth(utterance);
        return utterance as unknown as SpeechHandle;
      }

      // ── English, Kokoro not loaded yet: use Web Speech immediately ──────
      // The model loads in the background; next response will use Kokoro.
      if (!kokoroReady) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-US";
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        safeSynth(utterance);
        return utterance as unknown as SpeechHandle;
      }

      // ── English, Kokoro ready: stream neural TTS ────────────────────────
      const handle: SpeechHandle = { onend: null };

      (async () => {
        try {
          const tts = await loadKokoro();
          if (genRef.current !== gen) return;

          const ctx = new AudioContext({ sampleRate: 24000 });
          if (ctx.state === "suspended") await ctx.resume();
          audioCtxRef.current = ctx;

          let scheduledEnd = ctx.currentTime;
          const stream = tts.stream(text, { voice: "af_heart" });

          for await (const { audio } of stream) {
            if (genRef.current !== gen) { ctx.close(); return; }
            const buf = ctx.createBuffer(1, audio.data.length, audio.sampling_rate);
            buf.getChannelData(0).set(audio.data);
            const src = ctx.createBufferSource();
            src.buffer = buf;
            src.connect(ctx.destination);
            const startAt = Math.max(ctx.currentTime, scheduledEnd);
            src.start(startAt);
            scheduledEnd = startAt + buf.duration;
          }

          const remainingMs = Math.max(0, scheduledEnd - ctx.currentTime) * 1000 + 150;
          await new Promise<void>((r) => setTimeout(r, remainingMs));
          if (genRef.current === gen) handle.onend?.(new Event("end"));
        } catch {
          // Kokoro crashed mid-session — reset and fall back to Web Speech
          kokoroReady = false;
          kokoroPromise = null;
          if (genRef.current !== gen) return;
          const fallback = new SpeechSynthesisUtterance(text);
          fallback.lang = "en-US";
          fallback.rate = 0.9;
          fallback.onend = () => {
            if (genRef.current === gen) handle.onend?.(new Event("end"));
          };
          safeSynth(fallback);
        }
      })();

      return handle;
    },
    []
  );

  const cancelSpeech = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    }
    genRef.current++; // invalidate any in-flight Kokoro stream
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
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
