"use client";
import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatMessage } from "@/lib/types";
import ReportView from "@/components/ReportView";

// ── Verdict metadata ──────────────────────────────────────────────────────────
const VERDICT_META: Record<string, { color: string; bg: string; label: string }> = {
  UNSAFE:    { color: "var(--urgent)",    bg: "var(--urgent-bg)",    label: "Unsafe"               },
  CAUTION:   { color: "var(--watch)",     bg: "var(--watch-bg)",     label: "Caution"              },
  SAFE:      { color: "var(--well)",      bg: "var(--well-bg)",      label: "Safe"                 },
  EMERGENCY: { color: "var(--urgent)",    bg: "var(--urgent-bg)",    label: "Emergency"            },
  INFO:      { color: "var(--info)",      bg: "var(--info-bg)",      label: "Info"                 },
  REFUSE:    { color: "var(--ink-soft)",  bg: "var(--surface-sunk)", label: "Cannot Verify"        },
  CONFIRMED: { color: "var(--well)",      bg: "var(--well-bg)",      label: "Confirmed"            },
  CANCELLED: { color: "var(--ink-soft)",  bg: "var(--surface-sunk)", label: "Cancelled"            },
  CLARIFY:   { color: "var(--info)",      bg: "var(--info-bg)",      label: "Clarification Needed" },
};

const EXAMPLE_PROMPTS = [
  "Is ibuprofen safe for Baba?",
  "Check for household drug patterns",
  "Is paracetamol safe during pregnancy?",
  "Generate a health report for Ma",
];

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ── Typing Indicator ──────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <motion.div
      className="flex items-end gap-3 px-5"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
        style={{
          background: "linear-gradient(135deg, var(--primary), var(--primary-deep))",
          color: "var(--canvas)",
        }}
      >
        HT
      </div>
      <div
        className="flex items-center gap-1.5 px-4 py-3.5 rounded-2xl rounded-bl-sm"
        style={{
          background: "var(--glass)",
          border: "1px solid var(--border)",
          backdropFilter: "blur(12px)",
        }}
      >
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: "var(--primary)" }}
            animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyState({ onPromptClick }: { onPromptClick: (t: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-6">
      {/* Logo mark */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-base font-bold shadow-2xl"
            style={{
              background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
              color: "var(--canvas)",
              boxShadow: "0 0 40px rgba(34,211,238,0.3), 0 0 80px rgba(167,139,250,0.1)",
            }}
          >
            HT
          </div>
          <span
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px]"
            style={{ background: "var(--well)", color: "var(--canvas)" }}
          >
            AI
          </span>
        </div>
        <div>
          <h3 className="text-lg font-bold" style={{ color: "var(--ink)" }}>
            HealthTwin
          </h3>
          <p className="text-sm mt-0.5" style={{ color: "var(--ink-soft)" }}>
            Your family&apos;s AI health companion
          </p>
        </div>
      </div>

      {/* Example prompts */}
      <div className="flex flex-col gap-2 w-full max-w-sm">
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--ink-soft)" }}>
          Try asking
        </p>
        {EXAMPLE_PROMPTS.map((p) => (
          <motion.button
            key={p}
            onClick={() => onPromptClick(p)}
            className="text-sm text-left px-4 py-3 rounded-xl transition-all"
            style={{
              background: "var(--glass)",
              border: "1px solid var(--border)",
              color: "var(--ink-soft)",
              backdropFilter: "blur(8px)",
            }}
            whileHover={{
              scale: 1.01,
              borderColor: "var(--border-bright)",
              color: "var(--ink)",
            }}
            whileTap={{ scale: 0.99 }}
          >
            <span style={{ color: "var(--primary)", marginRight: 8 }}>›</span>
            {p}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// ── Single Message Bubble ─────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  const verdict = msg.envelope?.verdict ?? null;
  const meta = verdict ? (VERDICT_META[verdict] ?? null) : null;
  const isBn = msg.envelope?.language === "bn";

  if (isUser) {
    return (
      <motion.div
        className="flex justify-end px-5"
        initial={{ opacity: 0, x: 16, y: 4 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        <div className="max-w-[72%] flex flex-col items-end gap-1">
          <div
            className={`px-4 py-3 rounded-2xl rounded-br-sm text-sm leading-relaxed ${isBn ? "font-bn" : ""}`}
            style={{
              background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-deep) 100%)",
              color: "var(--canvas)",
              fontWeight: 500,
              boxShadow: "0 4px 20px rgba(34,211,238,0.2)",
            }}
          >
            {msg.text}
          </div>
          <span className="text-[10px] pr-1" style={{ color: "var(--ink-soft)" }}>
            {formatTime(msg.timestamp)}
          </span>
        </div>
      </motion.div>
    );
  }

  // Assistant bubble
  return (
    <motion.div
      className="flex items-end gap-3 px-5"
      initial={{ opacity: 0, x: -16, y: 4 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      {/* HT Avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mb-5"
        style={{
          background: "linear-gradient(135deg, var(--primary), var(--primary-deep))",
          color: "var(--canvas)",
          boxShadow: "0 0 12px rgba(34,211,238,0.25)",
        }}
      >
        HT
      </div>

      <div className="max-w-[76%] flex flex-col gap-1">
        {/* Verdict badge row */}
        {meta && (
          <div className="flex items-center gap-2 mb-0.5 pl-0.5">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ backgroundColor: meta.bg, color: meta.color }}
            >
              {meta.label}
            </span>
            {msg.envelope?.display?.member && (
              <span className="text-[10px]" style={{ color: "var(--ink-soft)" }}>
                · {msg.envelope.display.member}
              </span>
            )}
          </div>
        )}

        {/* Bubble */}
        <div
          className={`px-4 py-3 rounded-2xl rounded-bl-sm text-sm leading-relaxed ${isBn ? "font-bn" : ""}`}
          style={{
            background: "var(--glass)",
            backdropFilter: "blur(12px)",
            border: `1px solid var(--border)`,
            borderLeft: meta ? `2.5px solid ${meta.color}` : "1px solid var(--border)",
            color: "var(--ink)",
          }}
        >
          {msg.text}

          {/* Conflict pill */}
          {msg.envelope?.display?.conflict && (
            <div
              className="mt-2.5 text-xs px-3 py-2 rounded-lg"
              style={{ backgroundColor: "var(--urgent-bg)", color: "var(--urgent)" }}
            >
              ⚠ {msg.envelope.display.conflict}
            </div>
          )}

          {/* Alternative */}
          {msg.envelope?.display?.alternative && (
            <div
              className="mt-2 text-xs px-3 py-2 rounded-lg font-medium"
              style={{ backgroundColor: "var(--well-bg)", color: "var(--well)" }}
            >
              ✓ Try: {msg.envelope.display.alternative}
            </div>
          )}
        </div>

        {/* Report card */}
        {msg.envelope?.display?.report_markdown && msg.envelope?.display?.title && (
          <ReportView
            compact
            report={{
              title: msg.envelope.display.title,
              markdown: msg.envelope.display.report_markdown,
              report_type: "",
              generated_at: new Date(msg.timestamp).toISOString(),
            }}
          />
        )}

        {/* Timestamp + source */}
        <div className="flex items-center gap-2 pl-0.5">
          <span className="text-[10px]" style={{ color: "var(--ink-soft)" }}>
            {formatTime(msg.timestamp)}
          </span>
          {msg.envelope?.evidence?.source && (
            <>
              <span className="text-[10px]" style={{ color: "var(--ink-soft)" }}>·</span>
              <span className="text-[10px]" style={{ color: "var(--ink-soft)" }}>
                {msg.envelope.evidence.source}
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
}

export default function ChatPanel({ messages, isThinking, onExampleClick }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto py-5 space-y-4 scrollbar-thin">
        {messages.length === 0 && !isThinking ? (
          <EmptyState onPromptClick={onExampleClick} />
        ) : (
          <>
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}
            </AnimatePresence>
            <AnimatePresence>
              {isThinking && <TypingIndicator />}
            </AnimatePresence>
          </>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
