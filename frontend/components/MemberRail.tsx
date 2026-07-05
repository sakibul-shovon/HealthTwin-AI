"use client";
import { motion, AnimatePresence } from "framer-motion";
import { HouseholdMember } from "@/lib/types";
import { useState, useRef } from "react";

interface Props {
  members: HouseholdMember[];
  activeMember: string | null;
  onSelect: (label: string) => void;
  onOpenManager?: (id?: number) => void;
}

const INITIALS_BG = [
  "from-teal-600 to-teal-800",
  "from-amber-500 to-orange-600",
  "from-emerald-600 to-emerald-800",
  "from-sky-600 to-blue-700",
  "from-rose-500 to-rose-700",
  "from-violet-500 to-violet-700",
];

function getRingColor(m: HouseholdMember): string {
  if (m.kidney_impaired || m.liver_impaired) return "var(--watch)";
  if (m.pregnant) return "var(--info)";
  if (m.allergies?.length > 0) return "var(--urgent)";
  return "var(--well)";
}

function MemberTooltip({ m }: { m: HouseholdMember }) {
  const flags: string[] = [];
  if (m.kidney_impaired) flags.push("Kidney");
  if (m.liver_impaired) flags.push("Liver");
  if (m.pregnant) flags.push("Pregnant");

  return (
    <div
      className="glass-bright rounded-xl px-3.5 py-2.5 whitespace-nowrap shadow-2xl z-50 pointer-events-none"
      style={{ minWidth: 140 }}
    >
      <p className="text-xs font-bold leading-tight" style={{ color: "var(--ink)" }}>
        {m.role_label}
      </p>
      <p className="text-[10px] mt-0.5" style={{ color: "var(--ink-soft)" }}>
        {m.age ? `${m.age}y · ` : ""}
        {m.sex === "M" ? "Male" : m.sex === "F" ? "Female" : "Unknown"}
      </p>
      {m.medications?.length > 0 && (
        <p className="text-[10px] mt-1 font-medium" style={{ color: "var(--primary)" }}>
          {m.medications.length} medication{m.medications.length > 1 ? "s" : ""}
        </p>
      )}
      {flags.length > 0 && (
        <p className="text-[10px] mt-0.5" style={{ color: "var(--watch)" }}>
          ⚠ {flags.join(", ")}
        </p>
      )}
    </div>
  );
}

interface TooltipState {
  memberId: number;
  y: number;
}

export default function MemberRail({ members, activeMember, onSelect, onOpenManager }: Props) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const railRef = useRef<HTMLElement>(null);

  function handleMouseEnter(e: React.MouseEvent<HTMLDivElement>, id: number) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ memberId: id, y: rect.top + rect.height / 2 });
  }

  return (
    <aside
      ref={railRef}
      className="flex flex-col items-center gap-3 py-5 px-2 overflow-y-auto"
      style={{ borderRight: "1px solid var(--border)" }}
    >
      {/* Add member button */}
      <motion.button
        onClick={() => onOpenManager?.()}
        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-light transition-colors mb-1"
        style={{
          color: "var(--ink-soft)",
          border: "1.5px dashed var(--border-bright)",
          background: "transparent",
        }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        aria-label="Add family member"
        title="Add member"
      >
        +
      </motion.button>

      {/* Member avatars */}
      {members.map((m, idx) => {
        const active = m.role_label === activeMember;
        const hasFlag = m.kidney_impaired || m.liver_impaired || m.pregnant;
        const hasAllergy = m.allergies?.length > 0;
        const ringColor = getRingColor(m);
        const gradClass = INITIALS_BG[idx % INITIALS_BG.length];

        return (
          <div
            key={m.id}
            onMouseEnter={(e) => handleMouseEnter(e, m.id)}
            onMouseLeave={() => setTooltip(null)}
          >
            <motion.button
              onClick={() => onSelect(m.role_label)}
              className={`relative w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-200 bg-gradient-to-br ${gradClass}`}
              style={{
                boxShadow: active
                  ? `0 0 0 2px var(--canvas), 0 0 0 3.5px var(--primary), 0 4px 14px rgba(15,76,85,0.28)`
                  : `0 0 0 2px var(--canvas), 0 0 0 2px ${ringColor}22`,
                opacity: active ? 1 : 0.7,
                color: "white",
                textShadow: "0 1px 3px rgba(0,0,0,0.5)",
              }}
              whileHover={{ scale: 1.12, opacity: 1 }}
              whileTap={{ scale: 0.95 }}
              aria-label={`Select ${m.role_label}`}
              aria-pressed={active}
            >
              {m.role_label[0].toUpperCase()}

              {/* Flag dot */}
              {(hasFlag || hasAllergy) && !active && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                  style={{
                    backgroundColor: hasAllergy ? "var(--urgent)" : "var(--watch)",
                    borderColor: "var(--canvas)",
                  }}
                />
              )}

              {/* Medication dot */}
              {m.medications?.length > 0 && !hasFlag && !hasAllergy && !active && (
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2"
                  style={{ backgroundColor: "var(--primary)", borderColor: "var(--canvas)" }}
                />
              )}
            </motion.button>
          </div>
        );
      })}

      {/* Fixed-position tooltip — renders outside overflow-hidden parents */}
      <AnimatePresence>
        {tooltip && (() => {
          const m = members.find((x) => x.id === tooltip.memberId);
          if (!m) return null;
          return (
            <motion.div
              key={tooltip.memberId}
              className="glass-bright rounded-xl shadow-2xl pointer-events-none"
              style={{
                position: "fixed",
                left: 80,
                top: tooltip.y,
                transform: "translateY(-50%)",
                zIndex: 9999,
                minWidth: 148,
                padding: "10px 14px",
              }}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.14 }}
            >
              <MemberTooltip m={m} />
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </aside>
  );
}
