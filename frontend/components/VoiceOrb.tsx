"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useTwinStore } from "@/lib/store";

export type OrbState = "idle" | "listening" | "thinking" | "speaking" | "error";
type OrbSize = "full" | "md" | "sm";

const COLOR: Record<OrbState, string> = {
  idle:      "var(--primary)",
  listening: "var(--accent)",
  thinking:  "var(--primary-deep)",
  speaking:  "var(--well)",
  error:     "var(--urgent)",
};

const LABEL: Record<OrbState, string> = {
  idle:      "Tap to speak",
  listening: "Listening…",
  thinking:  "Thinking…",
  speaking:  "Speaking…",
  error:     "Didn't catch that — try again",
};

const ARIA_LABEL: Record<OrbState, string> = {
  idle:      "Start voice input",
  listening: "Listening — tap to stop",
  thinking:  "Processing your request",
  speaking:  "Speaking — tap to interrupt",
  error:     "Error — tap to try again",
};

// Button diameter per size
const BTN_SIZE: Record<OrbSize, number> = { full: 112, md: 72, sm: 44 };
// Icon size inside button
const ICON_SIZE: Record<OrbSize, number> = { full: 36, md: 24, sm: 16 };

function MicIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function WaveIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={Math.round(size * 0.67)} viewBox="0 0 36 24" fill="none"
      stroke="white" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <path d="M2 12 Q6 4 10 12 Q14 20 18 12 Q22 4 26 12 Q30 20 34 12" />
    </svg>
  );
}

function SpinnerIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="white" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" strokeDasharray="28 8" />
    </svg>
  );
}

interface VoiceOrbProps {
  onClick?: () => void;
  size?: OrbSize;
}

export default function VoiceOrb({ onClick, size = "full" }: VoiceOrbProps) {
  const orbState = useTwinStore((s) => s.orbState);
  const color = COLOR[orbState];
  const btn = BTN_SIZE[size];
  const icon = ICON_SIZE[size];
  const ring = btn + 8;
  // Container needs room for rings expanding out
  const container = size === "sm" ? btn + 16 : btn + 48;
  const showRings = size !== "sm";
  const showLabel = size === "full";

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      <div
        className="relative flex items-center justify-center"
        style={{ width: container, height: container }}
      >
        {/* Speaking ripple rings */}
        {showRings && (
          <AnimatePresence>
            {orbState === "speaking" &&
              [0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full pointer-events-none"
                  style={{ width: ring, height: ring, border: `2px solid ${color}` }}
                  initial={{ scale: 1, opacity: 0.6 }}
                  animate={{ scale: 2.6, opacity: 0 }}
                  exit={{}}
                  transition={{ duration: 1.8, delay: i * 0.6, repeat: Infinity, ease: "easeOut" }}
                />
              ))}
          </AnimatePresence>
        )}

        {/* Listening pulse ring */}
        {showRings && orbState === "listening" && (
          <motion.div
            className="absolute rounded-full pointer-events-none"
            style={{ width: ring, height: ring, border: `2px solid ${color}` }}
            animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        {/* Thinking spinning dashed ring */}
        {showRings && orbState === "thinking" && (
          <motion.div
            className="absolute rounded-full pointer-events-none"
            style={{ width: ring + 8, height: ring + 8, border: `2px dashed ${color}`, opacity: 0.65 }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          />
        )}

        {/* Main orb button */}
        <motion.button
          onClick={onClick}
          aria-label={ARIA_LABEL[orbState]}
          className="relative z-10 rounded-full flex items-center justify-center shadow-xl"
          style={{ width: btn, height: btn, backgroundColor: color }}
          animate={
            orbState === "idle"
              ? { scale: [1, 1.05, 1] }
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
          whileHover={orbState !== "thinking" ? { scale: 1.08 } : {}}
          whileTap={{ scale: 0.93 }}
        >
          {/* Status dot for sm size (no icon space for full icon) */}
          {size === "sm" ? (
            <div
              className="w-3 h-3 rounded-full"
              style={{
                backgroundColor: "white",
                opacity: orbState === "idle" ? 0.7 : 1,
              }}
            />
          ) : (
            <>
              {(orbState === "idle" || orbState === "listening") && <MicIcon size={icon} />}
              {orbState === "speaking" && <WaveIcon size={icon} />}
              {orbState === "thinking" && (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}>
                  <SpinnerIcon size={icon} />
                </motion.div>
              )}
              {orbState === "error" && (
                <span style={{ color: "white", fontSize: btn * 0.28, fontWeight: "bold", lineHeight: 1 }}>!</span>
              )}
            </>
          )}
        </motion.button>
      </div>

      {/* State label — full size only */}
      {showLabel && (
        <motion.p
          key={orbState}
          className="text-sm font-medium"
          style={{ color: orbState === "error" ? "var(--urgent)" : "var(--ink-soft)" }}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          aria-live="polite"
          aria-atomic="true"
        >
          {LABEL[orbState]}
        </motion.p>
      )}
    </div>
  );
}
