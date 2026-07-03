"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { HouseholdMember } from "@/lib/types";

interface Props {
  members: HouseholdMember[];
  focusedMember: string | null;
  activeMember: string | null;
  alertMembers?: string[];
  verdict?: string | null;
  onSelect: (label: string) => void;
}

function nodePosition(index: number, total: number, radius: number) {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  return {
    x: Math.round(radius * Math.cos(angle)),
    y: Math.round(radius * Math.sin(angle)),
  };
}

// Per-member gradient colors
const NODE_GRADIENT: Record<string, [string, string]> = {
  Ma:    ["#22D3EE", "#0891B2"],
  Baba:  ["#818CF8", "#4F46E5"],
  Self:  ["#34D399", "#059669"],
  Child: ["#FBBF24", "#D97706"],
};
function getGradient(label: string): [string, string] {
  return NODE_GRADIENT[label] ?? ["#A78BFA", "#7C3AED"];
}

export default function Constellation({
  members,
  focusedMember,
  activeMember,
  alertMembers = [],
  verdict,
  onSelect,
}: Props) {
  // Fit inside the 320px right panel with padding
  const RADIUS = 96;
  const NODE_R = 26;          // node circle radius in px
  const SIZE = RADIUS * 2 + NODE_R * 4 + 8;   // ~272px total
  const cx = SIZE / 2;
  const cy = SIZE / 2;

  const isEmergency = verdict === "EMERGENCY";
  const isDimming =
    (verdict === "UNSAFE" || verdict === "CAUTION" || verdict === "EMERGENCY") &&
    focusedMember !== null;

  const focusColor   = isEmergency ? "#F87171" : "#22D3EE";
  const focusGlow    = isEmergency ? "rgba(248,113,113,0.30)" : "rgba(34,211,238,0.25)";

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

  // Unique gradient IDs per member
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
          {/* Per-node radial gradients */}
          {members.map((m, i) => {
            const [c1, c2] = getGradient(m.role_label);
            return (
              <radialGradient key={m.id} id={gradIds[i]} cx="50%" cy="30%" r="70%">
                <stop offset="0%" stopColor={c1} />
                <stop offset="100%" stopColor={c2} />
              </radialGradient>
            );
          })}
          {/* Center hub gradient */}
          <radialGradient id="hub-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0891B2" stopOpacity="0.2" />
          </radialGradient>
        </defs>

        {/* Outer ring guide (faint) */}
        <circle
          cx={cx} cy={cy} r={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth="1"
          strokeDasharray="3 6"
        />

        {/* Connector lines center → nodes */}
        {members.map((m, i) => {
          const pos = nodePosition(i, members.length, RADIUS);
          const focused = m.role_label === focusedMember;
          const alerted = alertMembers.includes(m.role_label);
          const [c1] = getGradient(m.role_label);
          return (
            <line
              key={m.id}
              x1={cx}
              y1={cy}
              x2={cx + pos.x}
              y2={cy + pos.y}
              stroke={alerted ? "#FBBF24" : focused ? focusColor : c1}
              strokeWidth={focused ? 1.5 : alerted ? 1.5 : 1}
              strokeDasharray={focused ? "none" : alerted ? "4 3" : "3 5"}
              opacity={focused ? 0.7 : alerted ? 0.65 : 0.22}
            />
          );
        })}

        {/* Travel dot: shoots from center to focused node */}
        <AnimatePresence>
          {focusedPos && (
            <motion.circle
              key={`travel-${burstKey}`}
              r={4}
              fill={focusColor}
              filter="url(#travel-glow)"
              initial={{ cx, cy, opacity: 1 }}
              animate={{ cx: cx + focusedPos.x, cy: cy + focusedPos.y, opacity: 0 }}
              exit={{}}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          )}
        </AnimatePresence>

        {/* Center hub */}
        <circle cx={cx} cy={cy} r={14} fill="url(#hub-grad)" />
        <circle cx={cx} cy={cy} r={7}  fill="#22D3EE" opacity={0.9} />
        <circle cx={cx} cy={cy} r={3}  fill="white"   opacity={0.95} />
      </svg>

      {/* Member nodes */}
      {members.map((m, i) => {
        const pos     = nodePosition(i, members.length, RADIUS);
        const focused = m.role_label === focusedMember;
        const active  = m.role_label === activeMember;
        const alerted = alertMembers.includes(m.role_label);
        const dimmed  = isDimming && !focused && !alerted;
        const [c1, c2] = getGradient(m.role_label);
        const D = NODE_R * 2;   // diameter

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
            animate={{ opacity: dimmed ? 0.25 : 1 }}
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
                  background: alerted && !focused ? "rgba(251,191,36,0.3)" : focusGlow,
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
                  border: "1.5px dashed #FBBF24",
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
                  ? "rgba(251,191,36,0.15)"
                  : active
                  ? `linear-gradient(135deg, ${c1}33, ${c2}22)`
                  : "rgba(255,255,255,0.06)",
                color: focused ? "white" : alerted ? "#FBBF24" : c1,
                border: `1.5px solid ${
                  focused ? c1 :
                  alerted ? "#FBBF24" :
                  active  ? c1 :
                  "rgba(255,255,255,0.12)"
                }`,
                boxShadow: focused
                  ? `0 0 16px ${c1}66, 0 0 4px ${c1}44`
                  : active
                  ? `0 0 8px ${c1}33`
                  : "none",
                textShadow: focused ? "0 1px 4px rgba(0,0,0,0.5)" : "none",
              }}
              animate={
                focused
                  ? isEmergency
                    ? { scale: [1, 1.1, 1], boxShadow: ["0 0 0px #F87171", "0 0 20px #F87171", "0 0 0px #F87171"] }
                    : { scale: [1, 1.06, 1] }
                  : { scale: 1 }
              }
              transition={focused ? { duration: 1.4, repeat: Infinity } : {}}
              whileHover={{ scale: 1.15 }}
            >
              {m.role_label[0].toUpperCase()}
            </motion.div>

            {/* Name label below node */}
            <div className="flex flex-col items-center mt-1.5" style={{ width: 60, marginLeft: -(60 - D) / 2 }}>
              <span
                className="text-[11px] font-semibold leading-tight text-center"
                style={{ color: focused ? c1 : "var(--ink)" }}
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
