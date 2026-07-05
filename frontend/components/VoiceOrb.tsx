"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useTwinStore } from "@/lib/store";

export type OrbState = "idle" | "listening" | "thinking" | "speaking" | "error";
type OrbSize = "full" | "md" | "sm";

// Marigold is the voice signature — it stays warm across idle/listening/speaking.
// Thinking shifts to calm petrol; error to rose. (See design brief §11.4.)
const GRADIENT: Record<OrbState, string> = {
  idle:      "linear-gradient(135deg, #EDB35F 0%, #C1741B 100%)",
  listening: "linear-gradient(135deg, #F4C77E 0%, #E2922F 100%)",
  thinking:  "linear-gradient(135deg, #13636F 0%, #0A363D 100%)",
  speaking:  "linear-gradient(135deg, #E9A94E 0%, #C1741B 100%)",
  error:     "linear-gradient(135deg, #D9596A 0%, #A8283A 100%)",
};

const GLOW_COLOR: Record<OrbState, string> = {
  idle:      "rgba(226,146,47,0.38)",
  listening: "rgba(242,199,120,0.50)",
  thinking:  "rgba(15,76,85,0.34)",
  speaking:  "rgba(226,146,47,0.42)",
  error:     "rgba(195,58,76,0.45)",
};

const RING_COLOR: Record<OrbState, string> = {
  idle:      "#E2922F",
  listening: "#E2922F",
  thinking:  "#0F4C55",
  speaking:  "#C1741B",
  error:     "#C33A4C",
};

const LABEL: Record<OrbState, string> = {
  idle:      "Tap to speak",
  listening: "Listening…",
  thinking:  "Thinking…",
  speaking:  "Speaking…",
  error:     "Try again",
};

const ARIA_LABEL: Record<OrbState, string> = {
  idle:      "Start voice input",
  listening: "Listening — tap to stop",
  thinking:  "Processing your request",
  speaking:  "Speaking — tap to interrupt",
  error:     "Error — tap to try again",
};

const BTN_SIZE: Record<OrbSize, number> = { full: 112, md: 64, sm: 40 };
const ICON_SIZE: Record<OrbSize, number> = { full: 36, md: 22, sm: 14 };

function MicIcon({ size, color = "white" }: { size: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function WaveIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={Math.round(size * 0.7)} viewBox="0 0 36 24" fill="none"
      stroke="white" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <path d="M2 12 Q6 4 10 12 Q14 20 18 12 Q22 4 26 12 Q30 20 34 12" />
    </svg>
  );
}

interface VoiceOrbProps {
  onClick?: () => void;
  size?: OrbSize;
}

export default function VoiceOrb({ onClick, size = "full" }: VoiceOrbProps) {
  const orbState = useTwinStore((s) => s.orbState);
  const gradient = GRADIENT[orbState];
  const glowColor = GLOW_COLOR[orbState];
  const ringColor = RING_COLOR[orbState];
  const btn = BTN_SIZE[size];
  const icon = ICON_SIZE[size];
  const showRings = size !== "sm";
  const showLabel = size === "full";
  const container = showRings ? btn + 56 : btn + 16;

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      <div
        className="relative flex items-center justify-center"
        style={{ width: container, height: container }}
      >
        {/* Multi-ring halo glow */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: btn + 20,
            height: btn + 20,
            background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
            opacity: 0.6,
            transition: "background 0.5s ease",
          }}
        />

        {/* Speaking burst rings */}
        {showRings && (
          <AnimatePresence>
            {orbState === "speaking" &&
              [0, 1, 2].map((i) => (
                <motion.div
                  key={`speak-${i}`}
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    width: btn + 4,
                    height: btn + 4,
                    border: `1.5px solid ${ringColor}`,
                  }}
                  initial={{ scale: 1, opacity: 0.7 }}
                  animate={{ scale: 2.8, opacity: 0 }}
                  exit={{}}
                  transition={{
                    duration: 2,
                    delay: i * 0.65,
                    repeat: Infinity,
                    ease: "easeOut",
                  }}
                />
              ))}
          </AnimatePresence>
        )}

        {/* Listening pulse ring */}
        {showRings && orbState === "listening" && (
          <motion.div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: btn + 16,
              height: btn + 16,
              border: `2px solid ${ringColor}`,
            }}
            animate={{ scale: [1, 1.35, 1], opacity: [0.7, 0, 0.7] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        {/* Thinking spinning ring */}
        {showRings && orbState === "thinking" && (
          <motion.div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: btn + 20,
              height: btn + 20,
              border: `2px dashed ${ringColor}`,
              opacity: 0.6,
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
          />
        )}

        {/* Main orb button */}
        <motion.button
          onClick={onClick}
          aria-label={ARIA_LABEL[orbState]}
          className="relative z-10 rounded-full flex items-center justify-center"
          style={{
            width: btn,
            height: btn,
            background: gradient,
            boxShadow: `0 ${size === "full" ? 10 : 6}px ${size === "full" ? 34 : 18}px ${glowColor}, 0 2px 8px rgba(16,38,42,0.14)`,
            transition: "background 0.4s ease, box-shadow 0.4s ease",
          }}
          animate={
            orbState === "idle"
              ? { scale: [1, 1.04, 1] }
              : orbState === "error"
              ? { scale: [1, 0.9, 1.04, 1] }
              : {}
          }
          transition={
            orbState === "idle"
              ? { duration: 3.5, repeat: Infinity, ease: "easeInOut" }
              : orbState === "error"
              ? { duration: 0.4, times: [0, 0.25, 0.7, 1] }
              : {}
          }
          whileHover={orbState !== "thinking" ? { scale: 1.07 } : {}}
          whileTap={{ scale: 0.93 }}
        >
          {size === "sm" ? (
            <div className="w-2.5 h-2.5 rounded-full bg-white opacity-90" />
          ) : (
            <>
              {(orbState === "idle" || orbState === "listening") && (
                <MicIcon size={icon} />
              )}
              {orbState === "speaking" && <WaveIcon size={icon} />}
              {orbState === "thinking" && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
                >
                  <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none"
                    stroke="white" strokeWidth="2.5" strokeLinecap="round">
                    <circle cx="12" cy="12" r="9" strokeDasharray="30 6" />
                  </svg>
                </motion.div>
              )}
              {orbState === "error" && (
                <span
                  style={{
                    color: "white",
                    fontSize: btn * 0.28,
                    fontWeight: 800,
                    lineHeight: 1,
                    fontFamily: "Bricolage Grotesque, sans-serif",
                  }}
                >
                  !
                </span>
              )}
            </>
          )}
        </motion.button>
      </div>

      {/* State label — full size only */}
      {showLabel && (
        <motion.p
          key={orbState}
          className="text-sm font-semibold tracking-wide"
          style={{
            color: orbState === "error" ? "var(--urgent)" : "var(--ink-soft)",
          }}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          aria-live="polite"
          aria-atomic="true"
        >
          {LABEL[orbState]}
        </motion.p>
      )}
    </div>
  );
}
