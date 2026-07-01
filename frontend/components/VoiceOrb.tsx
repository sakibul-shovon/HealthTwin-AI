"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useTwinStore } from "@/lib/store";

type OrbState = "idle" | "listening" | "thinking" | "speaking" | "error";

const COLOR: Record<OrbState, string> = {
  idle: "var(--primary)",
  listening: "var(--accent)",
  thinking: "var(--primary-deep)",
  speaking: "var(--well)",
  error: "var(--urgent)",
};

const LABEL: Record<OrbState, string> = {
  idle: "Tap to speak",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
  error: "Didn't catch that",
};

function MicSVG() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function WaveSVG() {
  return (
    <svg width="36" height="24" viewBox="0 0 36 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
      <path d="M2 12 Q6 4 10 12 Q14 20 18 12 Q22 4 26 12 Q30 20 34 12" />
    </svg>
  );
}

function SpinnerSVG() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" strokeDasharray="28 8" />
    </svg>
  );
}

export default function VoiceOrb({ onClick }: { onClick?: () => void }) {
  const orbState = useTwinStore((s) => s.orbState);
  const color = COLOR[orbState];

  return (
    <div className="flex flex-col items-center gap-3 select-none">
      <div className="relative flex items-center justify-center w-40 h-40">
        {/* Ripple rings — speaking state */}
        <AnimatePresence>
          {orbState === "speaking" &&
            [0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="absolute rounded-full"
                style={{ width: 112, height: 112, border: `2px solid ${color}` }}
                initial={{ scale: 1, opacity: 0.6 }}
                animate={{ scale: 2.6, opacity: 0 }}
                exit={{}}
                transition={{ duration: 1.8, delay: i * 0.6, repeat: Infinity, ease: "easeOut" }}
              />
            ))}
        </AnimatePresence>

        {/* Listening pulse ring */}
        {orbState === "listening" && (
          <motion.div
            className="absolute rounded-full"
            style={{ width: 112, height: 112, border: `2px solid ${color}` }}
            animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        {/* Thinking spinning dashed ring */}
        {orbState === "thinking" && (
          <motion.div
            className="absolute rounded-full"
            style={{ width: 120, height: 120, border: `2px dashed ${color}`, opacity: 0.6 }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          />
        )}

        {/* Main orb button */}
        <motion.button
          onClick={onClick}
          className="relative z-10 rounded-full flex items-center justify-center shadow-xl focus:outline-none"
          style={{ width: 112, height: 112, backgroundColor: color }}
          animate={
            orbState === "idle"
              ? { scale: [1, 1.04, 1] }
              : orbState === "error"
              ? { scale: [1, 0.92, 1.02, 1] }
              : {}
          }
          transition={
            orbState === "idle"
              ? { duration: 3, repeat: Infinity, ease: "easeInOut" }
              : orbState === "error"
              ? { duration: 0.4, times: [0, 0.3, 0.7, 1] }
              : {}
          }
          whileHover={orbState === "idle" ? { scale: 1.08 } : {}}
          whileTap={{ scale: 0.95 }}
        >
          {orbState === "listening" && <MicSVG />}
          {orbState === "speaking" && <WaveSVG />}
          {orbState === "thinking" && <SpinnerSVG />}
          {orbState === "idle" && <MicSVG />}
          {orbState === "error" && (
            <span className="text-white text-3xl font-bold leading-none">!</span>
          )}
        </motion.button>
      </div>

      {/* State label */}
      <motion.p
        key={orbState}
        className="text-sm font-medium"
        style={{ color: orbState === "error" ? "var(--urgent)" : "var(--ink-soft)" }}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        {LABEL[orbState]}
      </motion.p>
    </div>
  );
}
