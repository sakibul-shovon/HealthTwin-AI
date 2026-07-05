"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState, ReactNode } from "react";
import { HouseholdMember } from "@/lib/types";

interface Props {
  members: HouseholdMember[];
  focusedMember: string | null;
  activeMember: string | null;
  alertMembers?: string[];
  verdict?: string | null;
  onSelect: (label: string) => void;
  /** Rendered at the centre of the constellation — the Voice Orb lives here. */
  centerSlot?: ReactNode;
  /** Larger, center-stage sizing for the hero layout. */
  hero?: boolean;
}

function nodePosition(index: number, total: number, radius: number) {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  return {
    x: Math.round(radius * Math.cos(angle)),
    y: Math.round(radius * Math.sin(angle)),
  };
}

// Per-member gradients — warm, muted identities so the STATUS halos carry meaning.
const NODE_GRADIENT: Record<string, [string, string]> = {
  Ma:    ["#2E9B8A", "#0F6B62"],  // teal
  Baba:  ["#4F86C6", "#2E5E9E"],  // calm blue
  Self:  ["#3FA06B", "#2E7D5B"],  // well green
  Child: ["#E9A94E", "#C1741B"],  // marigold
};
function getGradient(label: string): [string, string] {
  return NODE_GRADIENT[label] ?? ["#7B8FA0", "#4A5A6A"]; // slate fallback
}

const ALERT = "#D99A00";

export default function Constellation({
  members,
  focusedMember,
  activeMember,
  alertMembers = [],
  verdict,
  onSelect,
  centerSlot,
  hero = false,
}: Props) {
  const RADIUS = hero ? 152 : 96;
  const NODE_R = hero ? 32 : 26;             // node circle radius in px
  const LABEL_H = hero ? 48 : 0;             // extra bottom room for role+age labels
  const SIZE = RADIUS * 2 + NODE_R * 4 + 8 + LABEL_H;  // total svg canvas
  const cx = SIZE / 2;
  const cy = SIZE / 2;

  const isEmergency = verdict === "EMERGENCY";
  const isDimming =
    (verdict === "UNSAFE" || verdict === "CAUTION" || verdict === "EMERGENCY") &&
    focusedMember !== null;

  // Voice-resolved focus rides the marigold voice signature; emergencies go rose.
  const focusColor = isEmergency ? "#C33A4C" : "#E2922F";
  const focusGlow  = isEmergency ? "rgba(195,58,76,0.30)" : "rgba(226,146,47,0.30)";

  const [burstKey, setBurstKey] = useState(0);
  const prevFocused = useRef<string | null>(null);
  useEffect(() => {
    if (focusedMember && focusedMember !== prevFocused.current) {
      setBurstKey((k) => k + 1);
    }
    prevFocused.current = focusedMember;
  }, [focusedMember]);

  const focusedPos = focusedMember
    ? nodePosition(
        members.findIndex((m) => m.role_label === focusedMember),
        members.length,
        RADIUS,
      )
    : null;

  const gradIds = members.map((m) => `ng-${m.id}`);

  return (
    <div
      role="group"
      aria-label="Family constellation"
      className="relative flex items-center justify-center select-none"
      style={{ width: SIZE, height: SIZE }}
    >
      <svg
        className="absolute inset-0 pointer-events-none"
        width={SIZE}
        height={SIZE}
        aria-hidden="true"
        overflow="visible"
      >
        <defs>
          {members.map((m, i) => {
            const [c1, c2] = getGradient(m.role_label);
            return (
              <radialGradient key={m.id} id={gradIds[i]} cx="50%" cy="30%" r="70%">
                <stop offset="0%" stopColor={c1} />
                <stop offset="100%" stopColor={c2} />
              </radialGradient>
            );
          })}
          <radialGradient id="hub-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0F4C55" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#0F4C55" stopOpacity="0.08" />
          </radialGradient>
        </defs>

        {/* Outer ring guide (faint) */}
        <circle
          cx={cx} cy={cy} r={RADIUS}
          fill="none"
          stroke="rgba(19,45,49,0.09)"
          strokeWidth="1"
          strokeDasharray="3 6"
        />

        {/* Connector lines centre → nodes */}
        {members.map((m, i) => {
          const pos = nodePosition(i, members.length, RADIUS);
          const focused = m.role_label === focusedMember;
          const alerted = alertMembers.includes(m.role_label);
          const [, c2] = getGradient(m.role_label);
          return (
            <line
              key={m.id}
              x1={cx}
              y1={cy}
              x2={cx + pos.x}
              y2={cy + pos.y}
              stroke={alerted ? ALERT : focused ? focusColor : c2}
              strokeWidth={focused ? 1.75 : alerted ? 1.75 : 1}
              strokeDasharray={focused ? "none" : alerted ? "4 3" : "3 5"}
              opacity={focused ? 0.65 : alerted ? 0.6 : 0.2}
            />
          );
        })}

        {/* Travel dot: shoots from the orb centre to the focused node */}
        <AnimatePresence>
          {focusedPos && (
            <motion.circle
              key={`travel-${burstKey}`}
              r={hero ? 5 : 4}
              fill={focusColor}
              initial={{ cx, cy, opacity: 1 }}
              animate={{ cx: cx + focusedPos.x, cy: cy + focusedPos.y, opacity: 0 }}
              exit={{}}
              transition={{ duration: 0.55, ease: "easeOut" }}
            />
          )}
        </AnimatePresence>

        {/* Static hub — only when no orb occupies the centre */}
        {!centerSlot && (
          <>
            <circle cx={cx} cy={cy} r={14} fill="url(#hub-grad)" />
            <circle cx={cx} cy={cy} r={7}  fill="#0F4C55" opacity={0.85} />
            <circle cx={cx} cy={cy} r={3}  fill="#E2922F" opacity={0.95} />
          </>
        )}
      </svg>

      {/* Centre slot — the Voice Orb */}
      {centerSlot && (
        <div
          className="absolute z-20 flex items-center justify-center"
          style={{ left: cx, top: cy, transform: "translate(-50%, -50%)" }}
        >
          {centerSlot}
        </div>
      )}

      {/* Member nodes */}
      {members.map((m, i) => {
        const pos     = nodePosition(i, members.length, RADIUS);
        const focused = m.role_label === focusedMember;
        const active  = m.role_label === activeMember;
        const alerted = alertMembers.includes(m.role_label);
        const dimmed  = isDimming && !focused && !alerted;
        const [c1, c2] = getGradient(m.role_label);
        const D = NODE_R * 2;

        return (
          <motion.div
            key={m.id}
            role="button"
            tabIndex={0}
            aria-label={`${m.role_label} — ${m.age} years${alerted ? " — pattern alert" : ""}${focused ? " — focused" : ""}`}
            aria-pressed={active}
            className="absolute flex flex-col items-center cursor-pointer z-10 outline-none"
            style={{
              left: cx + pos.x - NODE_R,
              top:  cy + pos.y - NODE_R,
              width: D,
            }}
            animate={{ opacity: dimmed ? 0.3 : 1 }}
            transition={{ duration: 0.35 }}
            onClick={() => onSelect(m.role_label)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(m.role_label);
              }
            }}
          >
            {/* Burst ripple on focus */}
            <AnimatePresence>
              {focused && [0, 1].map((ring) => (
                <motion.div
                  key={`burst-${burstKey}-${ring}`}
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    width: D, height: D,
                    border: `1.5px solid ${focusColor}`,
                    left: 0, top: 0,
                  }}
                  initial={{ scale: 1, opacity: 0.8 }}
                  animate={{ scale: 3, opacity: 0 }}
                  exit={{}}
                  transition={{ duration: 1.0, delay: ring * 0.28, ease: "easeOut" }}
                />
              ))}
            </AnimatePresence>

            {/* Glow behind focused / alerted node */}
            {(focused || alerted) && (
              <motion.div
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: D + 16, height: D + 16,
                  left: -8, top: -8,
                  background: alerted && !focused ? "rgba(217,154,0,0.28)" : focusGlow,
                  filter: "blur(10px)",
                }}
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.8, repeat: Infinity }}
              />
            )}

            {/* Alert pulsing ring */}
            {alerted && !focused && (
              <motion.div
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: D + 6, height: D + 6,
                  border: `1.5px dashed ${ALERT}`,
                  left: -3, top: -3,
                }}
                animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.06, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
            )}

            {/* Node circle */}
            <motion.div
              className="rounded-full flex items-center justify-center font-bold relative z-10"
              style={{
                width: D, height: D,
                fontSize: NODE_R * 0.65,
                background: focused
                  ? `linear-gradient(135deg, ${c1}, ${c2})`
                  : alerted
                  ? "var(--watch-bg)"
                  : active
                  ? `linear-gradient(135deg, ${c1}22, ${c2}18)`
                  : "var(--surface)",
                color: focused ? "#fff" : alerted ? "var(--watch)" : c2,
                border: `1.5px solid ${
                  focused ? c1 :
                  alerted ? ALERT :
                  active  ? c1 :
                  "var(--border-bright)"
                }`,
                boxShadow: focused
                  ? `0 4px 16px ${c1}44, 0 1px 3px rgba(16,38,42,0.12)`
                  : active
                  ? `0 2px 8px ${c1}22`
                  : "var(--shadow-sm)",
                textShadow: focused ? "0 1px 4px rgba(0,0,0,0.35)" : "none",
              }}
              animate={
                focused
                  ? isEmergency
                    ? { scale: [1, 1.1, 1], boxShadow: ["0 0 0px #C33A4C", "0 0 22px #C33A4C88", "0 0 0px #C33A4C"] }
                    : { scale: [1, 1.06, 1] }
                  : { scale: 1 }
              }
              transition={focused ? { duration: 1.4, repeat: Infinity } : {}}
              whileHover={{ scale: 1.15 }}
            >
              {m.role_label[0].toUpperCase()}
            </motion.div>

            {/* Name label below node */}
            <div className="flex flex-col items-center mt-1.5" style={{ width: 64, marginLeft: -(64 - D) / 2 }}>
              <span
                className="text-[11px] font-semibold leading-tight text-center"
                style={{ color: focused ? c2 : "var(--ink)" }}
              >
                {m.role_label}
              </span>
              <span className="text-[9px] text-center" style={{ color: "var(--ink-soft)" }}>
                {m.age}y
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
