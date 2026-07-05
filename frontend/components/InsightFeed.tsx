"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { InsightItem } from "@/lib/types";

const SEV_CONFIG = {
  HIGH: { color: "var(--urgent)",  bg: "var(--urgent-bg)",  border: "var(--urgent)",  icon: "⬤", pulse: true  },
  MED:  { color: "var(--watch)",   bg: "var(--watch-bg)",   border: "var(--watch)",   icon: "⬤", pulse: false },
  LOW:  { color: "var(--well)",    bg: "var(--well-bg)",    border: "var(--well)",    icon: "⬤", pulse: false },
};

const CAT_ICON: Record<string, string> = {
  interaction:      "⇌",
  contraindication: "⊘",
  allergy:          "◈",
  dose:             "⊡",
  flag:             "⚑",
  poly:             "⊞",
};

function InsightCard({
  insight,
  index,
  onAsk,
}: {
  insight: InsightItem;
  index: number;
  onAsk: (q: string) => void;
}) {
  const cfg = SEV_CONFIG[insight.severity] ?? SEV_CONFIG.MED;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: index * 0.07 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: "var(--surface)",
        border: `1px solid var(--border)`,
        borderLeft: `3px solid ${cfg.border}`,
      }}
    >
      <div className="px-4 py-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Severity dot */}
            {cfg.pulse ? (
              <span className="relative shrink-0 flex h-2.5 w-2.5">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                  style={{ backgroundColor: cfg.color }}
                />
                <span
                  className="relative inline-flex rounded-full h-2.5 w-2.5"
                  style={{ backgroundColor: cfg.color }}
                />
              </span>
            ) : (
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
            )}

            {/* Category icon + title */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-medium" style={{ color: cfg.color }}>
                  {CAT_ICON[insight.category] ?? "•"} {insight.title}
                </span>
              </div>
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 inline-block"
                style={{ background: cfg.bg, color: cfg.color }}
              >
                {insight.member}
              </span>
            </div>
          </div>

          {/* Severity badge */}
          <span
            className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded-full shrink-0"
            style={{ background: cfg.bg, color: cfg.color }}
          >
            {insight.severity}
          </span>
        </div>

        {/* Detail */}
        <p className="text-[11px] leading-snug mt-2" style={{ color: "var(--ink-soft)" }}>
          {insight.detail}
        </p>

        {/* Ask AI button */}
        <button
          onClick={() => onAsk(insight.action_query)}
          className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold transition-opacity hover:opacity-70"
          style={{ color: "var(--primary)" }}
        >
          Ask AI
          <span style={{ fontSize: 10 }}>→</span>
        </button>
      </div>
    </motion.div>
  );
}

interface Props {
  insights: InsightItem[];
  onQuery: (q: string) => void;
}

export default function InsightFeed({ insights, onQuery }: Props) {
  const highCount = insights.filter((i) => i.severity === "HIGH").length;
  const medCount  = insights.filter((i) => i.severity === "MED").length;

  if (insights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-3">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg"
          style={{ background: "var(--well-bg)", color: "var(--well)" }}
        >
          ✓
        </div>
        <div>
          <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>All Clear</p>
          <p className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>
            No active alerts for this household.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Summary bar */}
      <div className="shrink-0 px-4 py-2.5 flex items-center gap-2 flex-wrap"
        style={{ borderBottom: "1px solid var(--border)" }}>
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--ink-faint)" }}>
          AI is watching
        </span>
        {highCount > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: "var(--urgent-bg)", color: "var(--urgent)" }}>
            {highCount} HIGH
          </span>
        )}
        {medCount > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: "var(--watch-bg)", color: "var(--watch)" }}>
            {medCount} MED
          </span>
        )}
      </div>

      {/* Scrollable cards */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        <AnimatePresence>
          {insights.map((ins, i) => (
            <InsightCard key={ins.id} insight={ins} index={i} onAsk={onQuery} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
