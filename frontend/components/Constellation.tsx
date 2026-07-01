"use client";
import { motion } from "framer-motion";
import { HouseholdMember } from "@/lib/types";

interface Props {
  members: HouseholdMember[];
  focusedMember: string | null;
  activeMember: string | null;
  onSelect: (label: string) => void;
}

// Distribute members in a circle around the centre. Index 0 = top, going clockwise.
function nodePosition(index: number, total: number, radius: number) {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  return {
    x: Math.round(radius * Math.cos(angle)),
    y: Math.round(radius * Math.sin(angle)),
  };
}

const INITIALS: Record<string, string> = {
  Baba: "B",
  Ma: "M",
  Self: "S",
  Child: "C",
};

export default function Constellation({ members, focusedMember, activeMember, onSelect }: Props) {
  const RADIUS = 140;
  const SIZE = RADIUS * 2 + 80; // container size

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: SIZE, height: SIZE }}
    >
      {/* Connector lines */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width={SIZE}
        height={SIZE}
        style={{ zIndex: 0 }}
      >
        {members.map((m, i) => {
          const pos = nodePosition(i, members.length, RADIUS);
          const cx = SIZE / 2;
          const cy = SIZE / 2;
          const focused = m.role_label === focusedMember;
          return (
            <line
              key={m.id}
              x1={cx}
              y1={cy}
              x2={cx + pos.x}
              y2={cy + pos.y}
              stroke={focused ? "var(--accent)" : "var(--ink-faint)"}
              strokeWidth={focused ? 1.5 : 1}
              strokeDasharray={focused ? "none" : "4 4"}
              opacity={focused ? 0.8 : 0.4}
            />
          );
        })}
      </svg>

      {/* Member nodes */}
      {members.map((m, i) => {
        const pos = nodePosition(i, members.length, RADIUS);
        const focused = m.role_label === focusedMember;
        const active = m.role_label === activeMember;

        return (
          <motion.div
            key={m.id}
            className="absolute flex flex-col items-center gap-1 cursor-pointer z-10"
            style={{
              left: SIZE / 2 + pos.x - 30,
              top: SIZE / 2 + pos.y - 30,
            }}
            onClick={() => onSelect(m.role_label)}
          >
            {/* Glow ring when focused */}
            {focused && (
              <motion.div
                className="absolute rounded-full"
                style={{
                  width: 60,
                  height: 60,
                  background: "var(--accent-glow)",
                  filter: "blur(10px)",
                  opacity: 0.7,
                }}
                animate={{ opacity: [0.5, 0.9, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}

            {/* Node circle */}
            <motion.div
              className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold shadow-md relative z-10"
              style={{
                backgroundColor: focused
                  ? "var(--accent)"
                  : active
                  ? "var(--primary-tint)"
                  : "var(--surface)",
                color: focused ? "white" : "var(--primary)",
                border: `2px solid ${focused ? "var(--accent-deep)" : active ? "var(--primary)" : "var(--ink-faint)"}`,
              }}
              animate={focused ? { scale: [1, 1.08, 1] } : { scale: 1 }}
              transition={focused ? { duration: 1.2, repeat: Infinity } : {}}
              whileHover={{ scale: 1.1 }}
            >
              {INITIALS[m.role_label] ?? m.role_label[0]}
            </motion.div>

            {/* Name + age label */}
            <div className="flex flex-col items-center" style={{ minWidth: 60 }}>
              <span
                className="text-xs font-semibold leading-tight"
                style={{ color: focused ? "var(--accent-deep)" : "var(--ink)" }}
              >
                {m.role_label}
              </span>
              <span className="text-[10px]" style={{ color: "var(--ink-faint)" }}>
                {m.age}y · {m.sex}
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
