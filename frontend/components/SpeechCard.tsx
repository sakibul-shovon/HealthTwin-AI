"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface Props {
  text: string;
  isPlaying: boolean;
  onStop: () => void;
}

const WPS = 2.6; // words per second
const BAR_AMPS = [0.55, 0.9, 0.65, 1.0, 0.72, 0.45, 0.85];

export default function SpeechCard({ text, isPlaying, onStop }: Props) {
  const [activeWord, setActiveWord] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef   = useRef<HTMLSpanElement | null>(null);
  const scrollRef   = useRef<HTMLDivElement | null>(null);

  const words = text.split(/\s+/).filter(Boolean);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!isPlaying) { setActiveWord(0); return; }

    setActiveWord(0);
    let idx = 0;
    intervalRef.current = setInterval(() => {
      idx++;
      if (idx >= words.length) { clearInterval(intervalRef.current!); return; }
      setActiveWord(idx);
    }, 1000 / WPS);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, text]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll active word into view
  useEffect(() => {
    const el = activeRef.current;
    const container = scrollRef.current;
    if (!el || !container) return;
    const elTop = el.offsetTop;
    const elBot = elTop + el.offsetHeight;
    const cTop  = container.scrollTop;
    const cBot  = cTop + container.clientHeight;
    if (elTop < cTop || elBot > cBot) {
      container.scrollTo({ top: elTop - container.clientHeight / 2, behavior: "smooth" });
    }
  }, [activeWord]);

  const progress = words.length > 0 ? Math.min(((activeWord + 1) / words.length) * 100, 100) : 0;

  return (
    <AnimatePresence>
      {isPlaying && (
        <motion.div
          initial={{ opacity: 0, y: -16, x: 16, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, x: 16, scale: 0.94 }}
          transition={{ type: "spring", stiffness: 340, damping: 30 }}
          className="fixed top-4 right-4 z-50 w-[300px] rounded-2xl overflow-hidden"
          style={{
            background: "var(--surface-raised)",
            border: "1.5px solid var(--border-strong)",
            boxShadow: [
              "var(--shadow-lg)",
              "0 0 0 1px rgba(15,76,85,0.06)",
            ].join(", "),
          }}
        >
          {/* Teal accent line at top */}
          <div className="absolute top-0 left-0 right-0 h-[2px]"
            style={{ background: "linear-gradient(90deg, transparent, var(--primary), var(--accent), transparent)" }} />

          {/* ── Header ─────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3"
            style={{ borderBottom: "1px solid var(--border)" }}>

            <div className="flex items-center gap-2.5">
              {/* S avatar */}
              <div
                className="w-7 h-7 rounded-xl flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                style={{ background: "linear-gradient(135deg, var(--primary), var(--accent))", boxShadow: "0 2px 10px rgba(15,76,85,0.25)" }}
              >
                S
              </div>

              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.16em]"
                  style={{ color: "var(--primary)" }}>Samantha</p>
                <p className="text-[11px] font-medium leading-tight"
                  style={{ color: "var(--ink-faint)" }}>Speaking now</p>
              </div>

              {/* Equalizer bars */}
              <div className="flex items-end gap-[2.5px] ml-1" style={{ height: 18 }}>
                {BAR_AMPS.map((amp, i) => (
                  <motion.div
                    key={i}
                    style={{
                      width: 2.5,
                      height: 18,
                      borderRadius: 2,
                      background: "var(--primary)",
                      opacity: 0.55 + amp * 0.45,
                      transformOrigin: "bottom",
                    }}
                    animate={{ scaleY: [amp, 0.2, amp * 1.15, 0.35, amp * 0.8, amp] }}
                    transition={{
                      duration: 0.75 + i * 0.08,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: i * 0.1,
                    }}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={onStop}
              className="w-6 h-6 rounded-lg flex items-center justify-center transition-all hover:opacity-60 active:scale-95"
              style={{ color: "var(--ink-faint)" }}
            >
              <X size={12} />
            </button>
          </div>

          {/* ── Word-by-word text ───────────────────────────────────── */}
          <div
            ref={scrollRef}
            className="px-4 py-3 text-[13px] leading-relaxed"
            style={{ maxHeight: 160, overflowY: "auto", scrollbarWidth: "none" }}
          >
            {words.map((word, i) => {
              const isPast   = i < activeWord;
              const isActive = i === activeWord;
              return (
                <span key={i}>
                  <motion.span
                    ref={isActive ? activeRef : null}
                    animate={
                      isActive
                        ? { color: "var(--primary-deep)" as string,  fontWeight: 700 }
                        : isPast
                        ? { color: "var(--ink-faint)"   as string,   fontWeight: 400 }
                        : { color: "var(--ink-soft)"    as string,   fontWeight: 400 }
                    }
                    transition={{ duration: 0.1 }}
                    style={{ display: "inline" }}
                  >
                    {word}
                  </motion.span>
                  {" "}
                </span>
              );
            })}
          </div>

          {/* ── Progress bar ────────────────────────────────────────── */}
          <div className="h-[3px] w-full" style={{ background: "var(--primary-tint)" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, var(--primary), var(--accent))" }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.38, ease: "linear" }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
