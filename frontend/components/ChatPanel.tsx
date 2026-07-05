"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatMessage, Gate1Trace, ResponseAction } from "@/lib/types";
import ReportView from "@/components/ReportView";

// ── Verdict metadata ──────────────────────────────────────────────────────────
const VERDICT_META: Record<string, { color: string; bg: string; label: string }> = {
  UNSAFE:    { color: "var(--urgent)",   bg: "var(--urgent-bg)",    label: "Unsafe"               },
  CAUTION:   { color: "var(--watch)",    bg: "var(--watch-bg)",     label: "Use with Care"        },
  SAFE:      { color: "var(--well)",     bg: "var(--well-bg)",      label: "Safe"                 },
  EMERGENCY: { color: "var(--urgent)",   bg: "var(--urgent-bg)",    label: "Emergency"            },
  INFO:      { color: "var(--info)",     bg: "var(--info-bg)",      label: "Info"                 },
  REFUSE:    { color: "var(--ink-soft)", bg: "var(--surface-sunk)", label: "Cannot Verify"        },
  CONFIRMED: { color: "var(--well)",     bg: "var(--well-bg)",      label: "Done"                 },
  CANCELLED: { color: "var(--ink-soft)", bg: "var(--surface-sunk)", label: "Cancelled"            },
  CLARIFY:   { color: "var(--info)",     bg: "var(--info-bg)",      label: "Clarification Needed" },
};

const EXAMPLE_PROMPTS = [
  "Is ibuprofen safe for Baba?",
  "Check for household patterns",
  "Is paracetamol safe during pregnancy?",
  "Generate a health report for Ma",
];

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ── Gate-1 inline why-panel ───────────────────────────────────────────────────
const TYPE_ICON: Record<string, string> = {
  interaction: "⇌", allergy: "◈", contraindication: "⊘", dose: "⊡",
};
const SEV_STYLE: Record<string, { background: string; color: string }> = {
  high:     { background: "var(--urgent-bg)", color: "var(--urgent)" },
  moderate: { background: "var(--watch-bg)",  color: "var(--watch)"  },
  low:      { background: "var(--well-bg)",   color: "var(--well)"   },
};

function WhyInline({ trace }: { trace: Gate1Trace }) {
  const checks = (
    Object.entries(trace.checked) as [keyof Gate1Trace["checked"], boolean][]
  ).filter(([, v]) => v);

  return (
    <div className="mt-2.5 space-y-2">
      {/* Checked gates row */}
      <div className="flex flex-wrap gap-1.5">
        {checks.map(([key]) => (
          <span
            key={key}
            className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-medium"
            style={{ background: "var(--surface-sunk)", color: "var(--ink-soft)" }}
          >
            <span style={{ color: "var(--well)", fontWeight: 700 }}>✓</span>
            {key.charAt(0).toUpperCase() + key.slice(1)}
          </span>
        ))}
      </div>

      {/* Conflicts */}
      {trace.conflicts.length === 0 ? (
        <p className="text-[11px]" style={{ color: "var(--well)" }}>
          All checks passed — no known contraindications.
        </p>
      ) : (
        trace.conflicts.map((c, i) => (
          <div
            key={i}
            className="rounded-xl px-3 py-2"
            style={{ background: "var(--surface-sunk)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={SEV_STYLE[c.severity] ?? SEV_STYLE.moderate}>
                {c.severity.toUpperCase()}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>
                {TYPE_ICON[c.type] ?? "•"} {c.type}
              </span>
            </div>
            <p className="text-[11px] leading-snug" style={{ color: "var(--ink)" }}>{c.detail}</p>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--ink-faint)" }}>Source: {c.source}</p>
          </div>
        ))
      )}
    </div>
  );
}

// ── Typing Indicator ──────────────────────────────────────────────────────────
const REASONING_STEPS = [
  { label: "Reading your question",   delay: 0.0  },
  { label: "Checking family records", delay: 0.55 },
  { label: "Running safety rules",    delay: 1.1  },
  { label: "Retrieving evidence",     delay: 1.7  },
  { label: "Computing verdict",       delay: 2.3  },
];

function ReasoningIndicator() {
  return (
    <motion.div
      className="flex items-start gap-2.5 px-4"
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
    >
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5"
        style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-deep))", color: "#fff" }}
      >
        HT
      </div>
      <div
        className="px-4 py-3 rounded-2xl rounded-tl-sm"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", minWidth: 210 }}
      >
        <p className="text-[9px] font-bold uppercase tracking-widest mb-2.5" style={{ color: "var(--ink-faint)" }}>
          AI Reasoning
        </p>
        <div className="space-y-1.5">
          {REASONING_STEPS.map((step, i) => (
            <motion.div
              key={step.label}
              className="flex items-center gap-2"
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: step.delay, duration: 0.22 }}
            >
              <motion.div
                className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 text-[7px]"
                style={{ background: "var(--surface-sunk)", color: "#fff" }}
                animate={i < REASONING_STEPS.length - 1
                  ? { background: ["var(--surface-sunk)", "var(--accent)", "var(--primary)"] }
                  : { background: ["var(--surface-sunk)", "var(--accent)"] }
                }
                transition={{ delay: step.delay + 0.25, duration: 0.4, times: [0, 0.5, 1] }}
              >
                {i < REASONING_STEPS.length - 1 ? "✓" : "…"}
              </motion.div>
              <span className="text-[11px]" style={{ color: "var(--ink-soft)" }}>{step.label}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyState({ onPromptClick }: { onPromptClick: (t: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-6">
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-sm font-bold"
            style={{
              background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
              color: "#fff",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            HT
          </div>
          <span
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold"
            style={{ background: "var(--well)", color: "#fff" }}
          >
            AI
          </span>
        </div>
        <div>
          <h3 className="text-base font-bold" style={{ color: "var(--ink)" }}>HealthTwin</h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--ink-soft)" }}>Your family&apos;s AI health companion</p>
        </div>
      </div>

      <div className="flex flex-col gap-2 w-full max-w-sm">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--ink-faint)" }}>
          Try asking
        </p>
        {EXAMPLE_PROMPTS.map((p) => (
          <motion.button
            key={p}
            onClick={() => onPromptClick(p)}
            className="text-sm text-left px-4 py-2.5 rounded-xl transition-all"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--ink-soft)",
            }}
            whileHover={{ borderColor: "var(--accent)66", color: "var(--ink)" }}
            whileTap={{ scale: 0.99 }}
          >
            <span style={{ color: "var(--accent)", marginRight: 8 }}>›</span>
            {p}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// ── Single Message Bubble ─────────────────────────────────────────────────────
function MessageBubble({
  msg,
  onAction,
}: {
  msg: ChatMessage;
  onAction?: (action: ResponseAction) => void;
}) {
  const [showWhy, setShowWhy] = useState(false);
  const isUser = msg.role === "user";
  const env = msg.envelope;
  const verdict = env?.verdict ?? null;
  const meta = verdict ? (VERDICT_META[verdict] ?? null) : null;
  const isBn = env?.language === "bn";

  // Only show detail if it adds information beyond the spoken text
  const detail = env?.display?.detail;
  const showDetail = detail && detail !== msg.text && detail.length > 10;

  const hasWhy =
    !!env?.gate1_trace &&
    ["SAFE", "CAUTION", "UNSAFE"].includes(verdict ?? "");

  if (isUser) {
    return (
      <motion.div
        className="flex justify-end px-4"
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="max-w-[78%] flex flex-col items-end gap-1">
          <div
            className={`px-4 py-2.5 rounded-2xl rounded-br-sm text-sm leading-relaxed ${isBn ? "font-bn" : ""}`}
            style={{
              background: "linear-gradient(135deg, var(--primary), var(--primary-deep))",
              color: "#fff",
              boxShadow: "0 2px 12px rgba(15,76,85,0.18)",
            }}
          >
            {msg.text}
          </div>
          <span className="text-[10px] pr-1" style={{ color: "var(--ink-faint)" }}>
            {formatTime(msg.timestamp)}
          </span>
        </div>
      </motion.div>
    );
  }

  // ── Assistant message ──────────────────────────────────────────────────────
  return (
    <motion.div
      className="flex items-start gap-2.5 px-4"
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Avatar */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5"
        style={{
          background: "linear-gradient(135deg, var(--primary), var(--primary-deep))",
          color: "#fff",
        }}
      >
        HT
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        {/* Verdict badge */}
        {meta && (
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-lg"
              style={{ backgroundColor: meta.color, color: "var(--canvas)" }}
            >
              {meta.label}
            </span>
            {env?.display?.member && (
              <span className="text-[10px] font-medium" style={{ color: "var(--ink-soft)" }}>
                {env.display.member}
              </span>
            )}
          </div>
        )}

        {/* Main bubble */}
        <div
          className={`rounded-2xl rounded-tl-sm ${isBn ? "font-bn" : ""}`}
          style={{
            background: "var(--surface)",
            border: `1px solid var(--border)`,
            borderLeft: meta ? `3px solid ${meta.color}` : "1px solid var(--border)",
            overflow: "hidden",
          }}
        >
          {/* Spoken text */}
          <div className="px-4 pt-3 pb-2">
            <p className="text-sm leading-relaxed" style={{ color: "var(--ink)" }}>
              {msg.text}
            </p>

            {/* Full detail (if different from spoken) */}
            {showDetail && (
              <p
                className="text-[13px] leading-relaxed mt-2 pt-2"
                style={{
                  borderTop: "1px solid var(--border)",
                  color: "var(--ink-soft)",
                  whiteSpace: "pre-line",
                }}
              >
                {detail}
              </p>
            )}
          </div>

          {/* Conflict pill */}
          {env?.display?.conflict && (
            <div
              className="mx-4 mb-2 text-xs px-3 py-2 rounded-xl flex items-start gap-2"
              style={{ backgroundColor: "var(--urgent-bg)", color: "var(--urgent)" }}
            >
              <span className="shrink-0 mt-px">⚠</span>
              <span>{env.display.conflict}</span>
            </div>
          )}

          {/* Alternative */}
          {env?.display?.alternative && (
            <div
              className="mx-4 mb-2 text-xs px-3 py-2 rounded-xl flex items-center gap-2 font-medium"
              style={{ backgroundColor: "var(--well-bg)", color: "var(--well)" }}
            >
              <span>✓</span>
              <span>Try: {env.display.alternative}</span>
            </div>
          )}

          {/* Report card */}
          {env?.display?.report_markdown && env?.display?.title && (
            <div className="px-4 pb-3">
              <ReportView
                compact
                report={{
                  title: env.display.title,
                  markdown: env.display.report_markdown,
                  report_type: "",
                  generated_at: new Date(msg.timestamp).toISOString(),
                }}
              />
            </div>
          )}

          {/* Actions */}
          {(env?.actions?.length ?? 0) > 0 && (
            <div className="px-4 pb-3 flex flex-wrap gap-2">
              {env!.actions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => onAction?.(action)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl transition-all"
                  style={{
                    background: "linear-gradient(135deg, var(--primary), var(--primary-deep))",
                    color: "#fff",
                    boxShadow: "0 2px 8px rgba(15,76,85,0.22)",
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}

          {/* Why this verdict toggle */}
          {hasWhy && (
            <div
              className="px-4 pb-3"
              style={{ borderTop: "1px dashed var(--border)", paddingTop: 8, marginTop: 2 }}
            >
              <button
                onClick={() => setShowWhy((v) => !v)}
                className="flex items-center gap-1.5 hover:opacity-70 transition-opacity"
                style={{ color: "var(--ink-faint)", fontSize: 11, fontWeight: 600 }}
              >
                <motion.span
                  animate={{ rotate: showWhy ? 180 : 0 }}
                  transition={{ duration: 0.18 }}
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
                    transition={{ duration: 0.2 }}
                    style={{ overflow: "hidden" }}
                  >
                    <WhyInline trace={env!.gate1_trace!} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Timestamp + source footer */}
        <div className="flex items-center gap-2 pl-1">
          <span className="text-[10px]" style={{ color: "var(--ink-faint)" }}>
            {formatTime(msg.timestamp)}
          </span>
          {env?.evidence?.source && (
            <>
              <span className="text-[10px]" style={{ color: "var(--ink-faint)" }}>·</span>
              <span className="text-[10px]" style={{ color: "var(--ink-faint)" }}>
                {env.evidence.source}
              </span>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Main ChatPanel ────────────────────────────────────────────────────────────
interface Props {
  messages: ChatMessage[];
  isThinking: boolean;
  onExampleClick: (text: string) => void;
  onAction?: (action: ResponseAction) => void;
}

export default function ChatPanel({ messages, isThinking, onExampleClick, onAction }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {messages.length === 0 && !isThinking ? (
          <EmptyState onPromptClick={onExampleClick} />
        ) : (
          <>
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} onAction={onAction} />
              ))}
            </AnimatePresence>
            <AnimatePresence>
              {isThinking && <ReasoningIndicator />}
            </AnimatePresence>
          </>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
