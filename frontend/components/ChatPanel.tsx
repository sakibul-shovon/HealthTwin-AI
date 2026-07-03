"use client";
import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatMessage } from "@/lib/types";
import ReportView from "@/components/ReportView";

// ── Verdict metadata ──────────────────────────────────────────────────────────
const VERDICT_META: Record<string, { color: string; bg: string; label: string }> = {
  UNSAFE:    { color: "var(--urgent)",    bg: "var(--urgent-bg)",   label: "Unsafe"        },
  CAUTION:   { color: "var(--watch)",     bg: "var(--watch-bg)",    label: "Caution"       },
  SAFE:      { color: "var(--well)",      bg: "var(--well-bg)",     label: "Safe"          },
  EMERGENCY: { color: "var(--urgent)",    bg: "var(--urgent-bg)",   label: "Emergency"     },
  INFO:      { color: "var(--info)",      bg: "var(--info-bg)",     label: "Info"          },
  REFUSE:    { color: "var(--ink-faint)", bg: "var(--surface-sunk)","label": "Cannot Verify" },
  CONFIRMED: { color: "var(--well)",      bg: "var(--well-bg)",     label: "Confirmed"     },
  CANCELLED: { color: "var(--ink-faint)", bg: "var(--surface-sunk)","label": "Cancelled"   },
  CLARIFY:   { color: "var(--info)",      bg: "var(--info-bg)",     label: "Clarification" },
};

const EXAMPLE_PROMPTS = [
  "Is ibuprofen safe for Baba?",
  "Check for household patterns",
  "Who is Baba's caregiver?",
  "Is paracetamol safe during pregnancy?",
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ── Typing Indicator ──────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <motion.div
      className="flex items-end gap-3 px-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
    >
      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
        style={{ backgroundColor: "var(--primary)", color: "white" }}
      >
        HT
      </div>
      <div
        className="flex items-center gap-1.5 px-4 py-3 rounded-2xl rounded-bl-sm"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--surface-sunk)" }}
      >
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: "var(--ink-faint)" }}
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
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
      <div>
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold mx-auto mb-4 shadow-md"
          style={{ backgroundColor: "var(--primary)", color: "white" }}
        >
          HT
        </div>
        <h3 className="text-base font-semibold mb-1" style={{ color: "var(--ink)" }}>
          HealthTwin Assistant
        </h3>
        <p className="text-sm" style={{ color: "var(--ink-faint)" }}>
          Ask about medications, symptoms, or your family's health.
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        {EXAMPLE_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => onPromptClick(p)}
            className="text-sm text-left px-4 py-2.5 rounded-xl transition-all hover:shadow-sm"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--surface-sunk)",
              color: "var(--ink-soft)",
            }}
          >
            {p}
          </button>
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
        className="flex justify-end px-4"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <div className="max-w-[75%] flex flex-col items-end gap-1">
          <div
            className={`px-4 py-3 rounded-2xl rounded-br-sm text-sm leading-relaxed shadow-sm ${isBn ? "font-bn" : ""}`}
            style={{ backgroundColor: "var(--primary)", color: "white" }}
          >
            {msg.text}
          </div>
          <span className="text-[10px] px-1" style={{ color: "var(--ink-faint)" }}>
            {formatTime(msg.timestamp)}
          </span>
        </div>
      </motion.div>
    );
  }

  // Assistant bubble
  return (
    <motion.div
      className="flex items-end gap-3 px-4"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      {/* HT Avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mb-5"
        style={{ backgroundColor: "var(--primary)", color: "white" }}
      >
        HT
      </div>

      <div className="max-w-[78%] flex flex-col gap-1">
        {/* Verdict badge row */}
        {meta && (
          <div className="flex items-center gap-2 mb-0.5 pl-1">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: meta.color }}
            />
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ backgroundColor: meta.bg, color: meta.color }}
            >
              {meta.label}
            </span>
            {msg.envelope?.display?.member && (
              <span className="text-[10px]" style={{ color: "var(--ink-faint)" }}>
                · {msg.envelope.display.member}
              </span>
            )}
          </div>
        )}

        {/* Bubble */}
        <div
          className={`px-4 py-3 rounded-2xl rounded-bl-sm text-sm leading-relaxed shadow-sm ${isBn ? "font-bn" : ""}`}
          style={{
            backgroundColor: "var(--surface)",
            border: `1px solid var(--surface-sunk)`,
            borderLeft: meta ? `3px solid ${meta.color}` : "1px solid var(--surface-sunk)",
            color: "var(--ink-soft)",
          }}
        >
          {msg.text}

          {/* Conflict pill inside bubble */}
          {msg.envelope?.display?.conflict && (
            <div
              className="mt-2 text-xs px-2.5 py-1.5 rounded-lg"
              style={{ backgroundColor: "var(--urgent-bg)", color: "var(--urgent)" }}
            >
              ⚠ {msg.envelope.display.conflict}
            </div>
          )}

          {/* Alternative inside bubble */}
          {msg.envelope?.display?.alternative && (
            <div
              className="mt-2 text-xs px-2.5 py-1.5 rounded-lg font-medium"
              style={{ backgroundColor: "var(--well-bg)", color: "var(--well)" }}
            >
              ✓ Try: {msg.envelope.display.alternative}
            </div>
          )}
        </div>

        {/* Report card — rendered outside the bubble, below it */}
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
        <div className="flex items-center gap-2 pl-1">
          <span className="text-[10px]" style={{ color: "var(--ink-faint)" }}>
            {formatTime(msg.timestamp)}
          </span>
          {msg.envelope?.evidence?.source && (
            <>
              <span className="text-[10px]" style={{ color: "var(--ink-faint)" }}>·</span>
              <span className="text-[10px]" style={{ color: "var(--ink-faint)" }}>
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
      <div className="flex-1 overflow-y-auto py-4 space-y-4 scrollbar-thin">
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
