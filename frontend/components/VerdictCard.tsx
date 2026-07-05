"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ResponseEnvelope, Gate1Trace } from "@/lib/types";

interface Props {
  response: ResponseEnvelope | null;
  onAction?: (action: { type: string; label: string; target: string | null; pending_id?: string }) => void;
}

const VERDICT_STYLE: Record<string, { color: string; bg: string; glow: string; badge: string }> = {
  UNSAFE:    { color: "var(--urgent)",   bg: "var(--urgent-bg)",    glow: "rgba(248,113,113,0.25)", badge: "Do Not Use"           },
  CAUTION:   { color: "var(--watch)",    bg: "var(--watch-bg)",     glow: "rgba(251,191,36,0.20)",  badge: "Use with Care"        },
  SAFE:      { color: "var(--well)",     bg: "var(--well-bg)",      glow: "rgba(52,211,153,0.20)",  badge: "Safe"                 },
  EMERGENCY: { color: "var(--urgent)",   bg: "var(--urgent-bg)",    glow: "rgba(248,113,113,0.30)", badge: "Emergency"            },
  INFO:      { color: "var(--info)",     bg: "var(--info-bg)",      glow: "rgba(129,140,248,0.20)", badge: "Info"                 },
  REFUSE:    { color: "var(--ink-soft)", bg: "var(--surface-sunk)", glow: "transparent",             badge: "Cannot Verify"       },
  CONFIRMED: { color: "var(--well)",     bg: "var(--well-bg)",      glow: "rgba(52,211,153,0.20)",  badge: "Confirmed"            },
  CANCELLED: { color: "var(--ink-soft)", bg: "var(--surface-sunk)", glow: "transparent",             badge: "Cancelled"           },
  CLARIFY:   { color: "var(--info)",     bg: "var(--info-bg)",      glow: "rgba(129,140,248,0.20)", badge: "Clarification Needed" },
};

const DEFAULT_STYLE = {
  color: "var(--ink)",
  bg: "var(--surface)",
  glow: "transparent",
  badge: "Result",
};

function ConfidenceBadge({ confidence }: { confidence: string | null }) {
  if (!confidence) return null;
  const colors: Record<string, { bg: string; text: string }> = {
    HIGH: { bg: "var(--well-bg)",   text: "var(--well)"   },
    MED:  { bg: "var(--watch-bg)",  text: "var(--watch)"  },
    LOW:  { bg: "var(--urgent-bg)", text: "var(--urgent)" },
  };
  const c = colors[confidence] ?? colors.MED;
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {confidence}
    </span>
  );
}

const TYPE_ICON: Record<string, string> = {
  interaction:      "⇌",
  allergy:          "◈",
  contraindication: "⊘",
  dose:             "⊡",
};

const SEV_STYLE: Record<string, { background: string; color: string }> = {
  high:     { background: "var(--urgent-bg)", color: "var(--urgent)" },
  moderate: { background: "var(--watch-bg)",  color: "var(--watch)"  },
  low:      { background: "var(--well-bg)",   color: "var(--well)"   },
};

function WhyPanel({ trace }: { trace: Gate1Trace }) {
  const CHECKS: { key: keyof Gate1Trace["checked"]; label: string }[] = [
    { key: "allergy",           label: "Allergies"         },
    { key: "interactions",      label: "Interactions"      },
    { key: "contraindications", label: "Contraindications" },
    { key: "dose",              label: "Dose"              },
  ];

  return (
    <div className="space-y-2.5 mt-3">
      {/* Checks row — what Gate 1 verified */}
      <div className="flex flex-wrap gap-1.5">
        {CHECKS.map(({ key, label }) =>
          trace.checked[key] ? (
            <span
              key={key}
              className="text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{ background: "var(--surface-sunk)", color: "var(--ink-soft)" }}
            >
              <span style={{ color: "var(--well)", fontWeight: 700 }}>✓</span>
              {label}
            </span>
          ) : null
        )}
      </div>

      {/* Conflict rows or all-clear */}
      {trace.conflicts.length === 0 ? (
        <p className="text-[11px]" style={{ color: "var(--well)" }}>
          All checks passed — no known contraindications found.
        </p>
      ) : (
        <div className="space-y-1.5">
          {trace.conflicts.map((c, i) => (
            <div
              key={i}
              className="rounded-xl px-3 py-2"
              style={{ background: "var(--surface-sunk)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={SEV_STYLE[c.severity] ?? SEV_STYLE.moderate}
                >
                  {c.severity.toUpperCase()}
                </span>
                <span
                  className="text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: "var(--ink-soft)" }}
                >
                  {TYPE_ICON[c.type] ?? "•"} {c.type}
                </span>
              </div>
              <p className="text-[11px] leading-snug" style={{ color: "var(--ink)" }}>
                {c.detail}
              </p>
              <p className="text-[10px] mt-1" style={{ color: "var(--ink-faint)" }}>
                Source: {c.source}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CardContent({ response, onAction }: { response: ResponseEnvelope; onAction?: Props["onAction"] }) {
  const [showWhy, setShowWhy] = useState(false);
  const style = (response.verdict && VERDICT_STYLE[response.verdict]) ?? DEFAULT_STYLE;
  const hasWhy =
    !!response.gate1_trace &&
    ["SAFE", "CAUTION", "UNSAFE"].includes(response.verdict ?? "");

  return (
    <motion.div
      key={response.display.title + response.verdict}
      className="rounded-2xl overflow-hidden"
      style={{
        border: `1px solid ${style.color}33`,
        background: "var(--surface)",
        boxShadow:
          style.glow !== "transparent"
            ? `0 0 0 1px ${style.color}22, var(--shadow-lg)`
            : "var(--shadow-md)",
      }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
    >
      {/* Verdict banner */}
      {response.verdict && (
        <div
          className="px-4 py-3 flex items-center justify-between gap-2"
          style={{ backgroundColor: style.bg, borderBottom: `1px solid ${style.color}22` }}
        >
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg shrink-0"
              style={{ backgroundColor: style.color, color: "var(--canvas)" }}
            >
              {style.badge}
            </span>

            {response.display.urgency && response.display.urgency !== "Emergency" && (
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                style={{
                  backgroundColor:
                    response.display.urgency === "Urgent"   ? "var(--urgent-bg)"
                    : response.display.urgency === "Moderate" ? "var(--watch-bg)"
                    : "var(--well-bg)",
                  color:
                    response.display.urgency === "Urgent"   ? "var(--urgent)"
                    : response.display.urgency === "Moderate" ? "var(--watch)"
                    : "var(--well)",
                }}
              >
                {response.display.urgency}
              </span>
            )}

            <span className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>
              {response.display.title}
            </span>
          </div>

          {response.display.member && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full shrink-0"
              style={{
                background: "var(--glass)",
                border: "1px solid var(--border-bright)",
                color: "var(--ink-soft)",
              }}
            >
              {response.display.member}
            </span>
          )}
        </div>
      )}

      {/* Body */}
      <div className="px-4 py-4 space-y-3">
        {response.display.interpreted && (
          <p className="text-[11px] italic" style={{ color: "var(--ink-soft)" }}>
            &ldquo;{response.display.interpreted}&rdquo;
          </p>
        )}

        {response.display.members && response.display.members.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--ink-soft)" }}>
              Involves
            </span>
            {response.display.members.map((m) => (
              <span
                key={m}
                className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "var(--watch-bg)", color: "var(--watch)" }}
              >
                {m}
              </span>
            ))}
          </div>
        )}

        {response.display.conflict && (
          <div
            className="flex items-start gap-2 rounded-xl px-3 py-2.5"
            style={{ backgroundColor: "var(--urgent-bg)", border: "1px solid var(--urgent)22" }}
          >
            <span className="text-sm mt-0.5 shrink-0">⚠</span>
            <p className="text-sm font-medium leading-snug" style={{ color: "var(--urgent)" }}>
              {response.display.conflict}
            </p>
          </div>
        )}

        {response.display.alternative && (
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2.5"
            style={{ backgroundColor: "var(--well-bg)", border: "1px solid var(--well)22" }}
          >
            <span className="text-sm shrink-0">✓</span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--well)" }}>
                Suggested alternative
              </p>
              <p className="text-sm font-bold" style={{ color: "var(--well)" }}>
                {response.display.alternative}
              </p>
            </div>
          </div>
        )}

        {response.display.detail && (() => {
          const isBn = response.language === "bn";
          const paras = response.display.detail.split(/\n\n+/).filter(Boolean);
          return (
            <div className={`space-y-2 ${isBn ? "font-bn" : ""}`}>
              {paras.map((para, i) => {
                const isLast = i === paras.length - 1 && paras.length > 1;
                return (
                  <p
                    key={i}
                    className={`text-sm leading-relaxed ${isLast ? "italic" : ""}`}
                    style={{ color: isLast ? "var(--ink-soft)" : "var(--ink)" }}
                  >
                    {para}
                  </p>
                );
              })}
            </div>
          );
        })()}

        {response.actions?.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {response.actions.map((action, i) => (
              <motion.button
                key={i}
                onClick={() => onAction?.(action)}
                className="text-sm font-semibold px-4 py-2 rounded-xl transition-all"
                style={{
                  background: "linear-gradient(135deg, var(--primary), var(--primary-deep))",
                  color: "#fff",
                  boxShadow: "0 4px 14px rgba(15,76,85,0.22)",
                }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                {action.label}
              </motion.button>
            ))}
          </div>
        )}

        {response.evidence?.source && (
          <div
            className="flex items-center justify-between pt-3"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <p className="text-[10px]" style={{ color: "var(--ink-soft)" }}>
              {response.evidence.source}
            </p>
            <div className="flex items-center gap-2">
              <ConfidenceBadge confidence={response.evidence.confidence} />
              {response.evidence.grounding_score != null && (
                <span className="text-[10px] font-mono-num" style={{ color: "var(--ink-soft)" }}>
                  {(response.evidence.grounding_score * 100).toFixed(0)}%
                </span>
              )}
            </div>
          </div>
        )}

        {/* Glass-box "Why this verdict?" — Gate 1 rule trace */}
        {hasWhy && (
          <div style={{ borderTop: "1px dashed var(--border)", paddingTop: 10 }}>
            <button
              onClick={() => setShowWhy((v) => !v)}
              className="flex items-center gap-1.5 transition-opacity hover:opacity-70"
              style={{ color: "var(--ink-faint)", fontSize: 11, fontWeight: 600 }}
            >
              <motion.span
                animate={{ rotate: showWhy ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                style={{ display: "inline-block", lineHeight: 1, fontSize: 9 }}
              >
                ▾
              </motion.span>
              {showWhy ? "Hide rule trace" : "Why this verdict?"}
            </button>

            <AnimatePresence>
              {showWhy && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22 }}
                  style={{ overflow: "hidden" }}
                >
                  <WhyPanel trace={response.gate1_trace!} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function VerdictCard({ response, onAction }: Props) {
  return (
    <AnimatePresence mode="wait">
      {!response ? (
        <motion.div
          key="empty"
          className="flex flex-col items-center justify-center py-8 gap-3"
          style={{ color: "var(--ink-soft)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "var(--glass)", border: "1px solid var(--border)" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4m0 4h.01" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-xs text-center" style={{ color: "var(--ink-soft)" }}>
            Ask something to see the verdict
          </p>
        </motion.div>
      ) : (
        <CardContent
          key={response.display.title + response.verdict}
          response={response}
          onAction={onAction}
        />
      )}
    </AnimatePresence>
  );
}
