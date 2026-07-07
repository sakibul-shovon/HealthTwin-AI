"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useTwinStore } from "@/lib/store";
import { useVoiceCommand } from "@/lib/VoiceCommandContext";
import { X, ChevronRight, Mic, Square } from "lucide-react";

const STATE_LABEL: Record<string, string> = {
  listening: "Listening…",
  thinking:  "Thinking…",
  speaking:  "Speaking…",
  error:     "Something went wrong",
  idle:      "Ready",
};

const STATE_DOT: Record<string, string> = {
  listening: "var(--accent)",
  thinking:  "var(--primary)",
  speaking:  "var(--well)",
  error:     "var(--urgent)",
  idle:      "var(--ink-faint)",
};

function Waveform() {
  return (
    <div className="flex items-end gap-[3px] h-3.5">
      {[0, 0.12, 0.24, 0.36, 0.48].map((d, i) => (
        <motion.span
          key={i}
          className="rounded-full"
          style={{ width: 2.5, background: "var(--accent)" }}
          animate={{ height: ["4px", "14px", "4px"] }}
          transition={{ duration: 0.7, repeat: Infinity, delay: d, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

const KEEP_OPEN_MS = 8000; // how long to keep overlay after response

export default function VoiceOverlay() {
  const pathname  = usePathname();
  const { orbState, messages } = useTwinStore();
  const { handleMicClick, isListening, cancelSpeech } = useVoiceCommand();

  const [lang, setLang]           = useState<"en" | "bn">("en");
  const [dismissed, setDismissed] = useState(false);
  const [keepOpen, setKeepOpen]   = useState(false);
  const timerRef           = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True only after the user actually speaks/types in this page session
  const voiceUsedThisSession = useRef(false);

  const lastUser      = [...messages].reverse().find(m => m.role === "user");
  const lastAssistant = [...messages].reverse().find(m => m.role === "assistant");
  const lastMsgId     = lastAssistant?.id;

  // Mark that voice was used the moment orbState leaves idle
  useEffect(() => {
    if (orbState !== "idle" || isListening) {
      voiceUsedThisSession.current = true;
      setDismissed(false);
    }
  }, [orbState, isListening]);

  // Keep overlay visible after response — but ONLY if voice was actually used
  // this session. This prevents the overlay from appearing on refresh when
  // AppShell loads chat history and lastMsgId changes from undefined → real id.
  useEffect(() => {
    if (!lastMsgId) return;
    if (!voiceUsedThisSession.current) return;
    setKeepOpen(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setKeepOpen(false), KEEP_OPEN_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [lastMsgId]);

  const isActive = orbState !== "idle" || isListening;
  const show     = (isActive || keepOpen) && pathname !== "/ask" && !dismissed;

  function handleClose() {
    cancelSpeech();
    setDismissed(true);
    setKeepOpen(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="voice-overlay"
          initial={{ opacity: 0, y: -16, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.94 }}
          transition={{ type: "spring", damping: 22, stiffness: 320 }}
          className="fixed top-4 right-4 z-[9999]"
          style={{ width: 300 }}
        >
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: "var(--surface-raised)",
              border: "1.5px solid var(--border-strong)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex items-center gap-2.5 px-4 py-3"
              style={{ borderBottom: "1px solid var(--border)" }}>

              {/* Animated S orb */}
              <motion.div
                className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-white text-sm shrink-0"
                style={{ background: "linear-gradient(135deg, var(--primary), var(--accent))", boxShadow: "0 2px 8px rgba(15,76,85,0.2)" }}
                animate={
                  orbState === "listening" ? { scale: [1, 1.12, 1] } :
                  orbState === "thinking"  ? { rotate: [0, 360] } :
                  orbState === "speaking"  ? { scale: [1, 1.06, 1] } : {}
                }
                transition={{
                  duration: orbState === "thinking" ? 1.8 : 1.2,
                  repeat: Infinity,
                  ease: orbState === "thinking" ? "linear" : "easeInOut",
                }}
              >S</motion.div>

              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--ink-faint)" }}>
                  SAMANTHA
                </p>
                <motion.p
                  key={orbState}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[12px] font-semibold leading-tight"
                  style={{ color: "var(--ink)" }}
                >
                  {STATE_LABEL[orbState] ?? "Ready"}
                </motion.p>
              </div>

              {/* Live dot */}
              {isActive && (
                <motion.div className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: STATE_DOT[orbState] ?? "var(--ink-faint)" }}
                  animate={{ opacity: [1, 0.25, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                />
              )}

              {/* Lang toggle */}
              <button
                onClick={() => setLang(l => l === "en" ? "bn" : "en")}
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-lg shrink-0 transition-all"
                style={{
                  background: lang === "bn" ? "var(--accent-tint)" : "var(--surface-sunk)",
                  color: lang === "bn" ? "var(--accent-deep)" : "var(--ink-soft)",
                }}
              >
                {lang === "en" ? "EN" : "বাং"}
              </button>

              {/* Close */}
              <button
                onClick={handleClose}
                className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 hover:opacity-70 transition-opacity"
                style={{ background: "var(--surface-sunk)", color: "var(--ink-soft)" }}
              >
                <X size={11} />
              </button>
            </div>

            {/* ── Conversation area ───────────────────────────────────────── */}
            <div className="px-4 py-3 flex flex-col gap-2" style={{ minHeight: 64 }}>

              {/* User bubble */}
              {lastUser && (
                <div className="flex justify-end">
                  <div
                    className="text-[11px] px-3 py-2 rounded-xl leading-snug max-w-[85%]"
                    style={{ background: "var(--primary-tint)", color: "var(--primary-deep)" }}
                  >
                    {lastUser.text}
                  </div>
                </div>
              )}

              {/* Samantha bubble */}
              <div className="flex gap-2 items-start">
                <div className="w-5 h-5 rounded-lg flex items-center justify-center font-bold text-white text-[9px] shrink-0 mt-0.5"
                  style={{ background: "linear-gradient(135deg, var(--primary), var(--accent))" }}>
                  S
                </div>
                <div
                  className="text-[11px] px-3 py-2 rounded-xl leading-snug flex-1"
                  style={{ background: "var(--surface-sunk)", color: "var(--ink)" }}
                >
                  <AnimatePresence mode="wait">
                    {orbState === "thinking" ? (
                      <motion.div key="dots"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex gap-1 items-center py-0.5">
                        {[0, 1, 2].map(i => (
                          <motion.div key={i} className="w-1 h-1 rounded-full"
                            style={{ background: "var(--ink-faint)" }}
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
                        ))}
                      </motion.div>
                    ) : lastAssistant ? (
                      <motion.span key={lastAssistant.id}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        {lastAssistant.text}
                      </motion.span>
                    ) : (
                      <motion.span key="hint"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="text-[10px]" style={{ color: "var(--ink-faint)" }}>
                        {lang === "bn" ? "বাংলায় কথা বলুন…" : "Tap the mic and speak…"}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* ── Footer ─────────────────────────────────────────────────── */}
            <div className="flex items-center gap-2.5 px-4 py-2.5"
              style={{ borderTop: "1px solid var(--border)" }}>

              {/* Mic button */}
              <motion.button
                onClick={() => handleMicClick(lang)}
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: isListening
                    ? "linear-gradient(135deg, var(--accent), var(--accent-deep))"
                    : "linear-gradient(135deg, var(--primary), var(--primary-deep))",
                  boxShadow: isListening ? "0 0 14px var(--accent-glow)" : "none",
                }}
                animate={isListening ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.85, repeat: Infinity }}
                whileTap={{ scale: 0.9 }}
              >
                {isListening ? <Square size={10} color="white" /> : <Mic size={12} color="white" />}
              </motion.button>

              {/* Waveform or hint */}
              <div className="flex-1 flex items-center">
                <AnimatePresence mode="wait">
                  {isListening ? (
                    <motion.div key="wave" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <Waveform />
                    </motion.div>
                  ) : (
                    <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="text-[10px]" style={{ color: "var(--ink-faint)" }}>
                      {lang === "bn" ? "বাংলায় বলুন" : "Tap mic to speak"}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* View chat */}
              <Link href="/ask"
                className="flex items-center gap-0.5 text-[10px] font-semibold shrink-0 hover:opacity-70 transition-opacity"
                style={{ color: "var(--ink-soft)" }}>
                View chat <ChevronRight size={10} />
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
