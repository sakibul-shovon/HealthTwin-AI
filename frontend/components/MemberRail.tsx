"use client";
import { motion } from "framer-motion";
import { HouseholdMember } from "@/lib/types";

interface Props {
  members: HouseholdMember[];
  activeMember: string | null;
  onSelect: (label: string) => void;
  onOpenManager?: (id?: number) => void;
}

const FLAG_LABELS: Record<string, string> = {
  kidney_impaired: "Kidney ⚠",
  liver_impaired: "Liver ⚠",
  pregnant: "Pregnant",
};

export default function MemberRail({ members, activeMember, onSelect, onOpenManager }: Props) {
  return (
    <aside className="flex flex-col gap-3 overflow-y-auto py-4 px-3">
      <div className="flex justify-between items-center mb-1">
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--ink-faint)" }}>
          Family
        </h2>
        <button onClick={() => onOpenManager && onOpenManager()} className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors">
          + Add
        </button>
      </div>
      {members.map((m) => {
        const active = m.role_label === activeMember;
        const flags: string[] = [];
        if (m.kidney_impaired) flags.push(FLAG_LABELS.kidney_impaired);
        if (m.liver_impaired) flags.push(FLAG_LABELS.liver_impaired);
        if (m.pregnant) flags.push(FLAG_LABELS.pregnant);

        return (
          <motion.button
            key={m.id}
            onClick={() => onSelect(m.role_label)}
            className="w-full text-left rounded-xl p-3 transition-colors relative group"
            style={{
              backgroundColor: active ? "var(--primary-tint)" : "var(--surface)",
              border: `1.5px solid ${active ? "var(--primary)" : "var(--surface-sunk)"}`,
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                style={{
                  backgroundColor: active ? "var(--primary)" : "var(--surface-sunk)",
                  color: active ? "white" : "var(--ink)",
                }}
              >
                {m.role_label[0]}
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight" style={{ color: "var(--ink)" }}>
                  {m.role_label}
                </p>
                <p className="text-[11px]" style={{ color: "var(--ink-faint)" }}>
                  {m.age}y · {m.sex === "M" ? "Male" : m.sex === "F" ? "Female" : "Unknown"}
                </p>
              </div>
              <div className="flex-1"></div>
              <button 
                onClick={(e) => { e.stopPropagation(); onOpenManager && onOpenManager(m.id); }}
                className="text-[14px] px-2 text-gray-400 hover:text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ⋯
              </button>
            </div>

            {m.medications.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {m.medications.map((med) => (
                  <span
                    key={med.name}
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-mono-num"
                    style={{ backgroundColor: "var(--primary-tint)", color: "var(--primary-deep)" }}
                  >
                    {med.name}
                  </span>
                ))}
              </div>
            )}

            {flags.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {flags.map((f) => (
                  <span
                    key={f}
                    className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: "var(--watch-bg)", color: "var(--watch)" }}
                  >
                    {f}
                  </span>
                ))}
              </div>
            )}

            {m.allergies.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {m.allergies.map((a) => (
                  <span
                    key={a.substance}
                    className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: "var(--urgent-bg)", color: "var(--urgent)" }}
                  >
                    Allergy: {a.substance}
                  </span>
                ))}
              </div>
            )}

            {m.reminders && m.reminders.filter(r => r.active).length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {m.reminders.filter(r => r.active).map((r) => (
                  <span
                    key={r.id}
                    className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: "var(--info-bg, #e8f4fd)", color: "var(--info, #1a6fa8)" }}
                  >
                    ⏰ {r.time}
                  </span>
                ))}
              </div>
            )}
          </motion.button>
        );
      })}
    </aside>
  );
}
