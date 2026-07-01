"use client";
import { motion, AnimatePresence } from "framer-motion";
import { ResponseEnvelope } from "@/lib/types";

interface Props {
  response: ResponseEnvelope | null;
  onAction?: (action: { type: string; label: string; target: string | null; pending_id?: string }) => void;
}

const VERDICT_STYLE: Record<
  string,
  { bg: string; border: string; text: string; badge: string }
> = {
  UNSAFE: {
    bg: "var(--urgent-bg)",
    border: "var(--urgent)",
    text: "var(--urgent)",
    badge: "Do Not Use",
  },
  CAUTION: {
    bg: "var(--watch-bg)",
    border: "var(--watch)",
    text: "var(--watch)",
    badge: "Use with Care",
  },
  SAFE: {
    bg: "var(--well-bg)",
    border: "var(--well)",
    text: "var(--well)",
    badge: "Safe",
  },
  EMERGENCY: {
    bg: "var(--urgent-bg)",
    border: "var(--urgent)",
    text: "var(--urgent)",
    badge: "Emergency",
  },
  INFO: {
    bg: "var(--info-bg)",
    border: "var(--info)",
    text: "var(--info)",
    badge: "Info",
  },
  REFUSE: {
    bg: "var(--surface-sunk)",
    border: "var(--ink-faint)",
    text: "var(--ink-soft)",
    badge: "Cannot Verify",
  },
  CONFIRMED: {
    bg: "var(--well-bg)",
    border: "var(--well)",
    text: "var(--well)",
    badge: "Confirmed",
  },
  CANCELLED: {
    bg: "var(--surface-sunk)",
    border: "var(--ink-faint)",
    text: "var(--ink-soft)",
    badge: "Cancelled",
  },
};

const DEFAULT_STYLE = {
  bg: "var(--surface)",
  border: "var(--ink-faint)",
  text: "var(--ink)",
  badge: "Result",
};

function ConfidenceBadge({ confidence }: { confidence: string | null }) {
  if (!confidence) return null;
  const colors: Record<string, { bg: string; text: string }> = {
    HIGH: { bg: "var(--well-bg)", text: "var(--well)" },
    MED: { bg: "var(--watch-bg)", text: "var(--watch)" },
    LOW: { bg: "var(--urgent-bg)", text: "var(--urgent)" },
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

export default function VerdictCard({ response, onAction }: Props) {
  return (
    <AnimatePresence mode="wait">
      {!response ? (
        <motion.div
          key="empty"
          className="flex flex-col items-center justify-center h-full"
          style={{ color: "var(--ink-faint)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z" />
            <path d="M12 8v4m0 4h.01" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <p className="text-sm mt-3">Ask something to see the verdict</p>
        </motion.div>
      ) : (
        <motion.div
          key={response.display.title + response.verdict}
          className="rounded-2xl overflow-hidden shadow-md"
          style={{ border: `1.5px solid ${(response.verdict && VERDICT_STYLE[response.verdict]?.border) ?? DEFAULT_STYLE.border}` }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {/* Verdict banner */}
          {response.verdict && (
            <div
              className="px-5 py-3 flex items-center justify-between"
              style={{ backgroundColor: (VERDICT_STYLE[response.verdict]?.bg) ?? DEFAULT_STYLE.bg }}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg"
                  style={{
                    backgroundColor: (VERDICT_STYLE[response.verdict]?.border) ?? DEFAULT_STYLE.border,
                    color: "white",
                  }}
                >
                  {(VERDICT_STYLE[response.verdict]?.badge) ?? response.verdict}
                </span>
                {/* Urgency badge from triage */}
                {response.display.urgency && response.display.urgency !== "Emergency" && (
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor:
                        response.display.urgency === "Urgent" ? "var(--urgent-bg)"
                        : response.display.urgency === "Moderate" ? "var(--watch-bg)"
                        : "var(--well-bg)",
                      color:
                        response.display.urgency === "Urgent" ? "var(--urgent)"
                        : response.display.urgency === "Moderate" ? "var(--watch)"
                        : "var(--well)",
                    }}
                  >
                    {response.display.urgency}
                  </span>
                )}
                <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                  {response.display.title}
                </span>
              </div>
              {response.display.member && (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--surface)", color: "var(--ink-soft)" }}>
                  {response.display.member}
                </span>
              )}
            </div>
          )}

          <div className="px-5 py-4 space-y-3" style={{ backgroundColor: "var(--surface)" }}>
            {/* Interpreted text */}
            {response.display.interpreted && (
              <p className="text-[11px] italic" style={{ color: "var(--ink-faint)" }}>
                I heard: &ldquo;{response.display.interpreted}&rdquo;
              </p>
            )}

            {/* Pattern alert: involved members pills */}
            {response.display.members && response.display.members.length > 1 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--ink-faint)" }}>
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

            {/* Conflict pill */}
            {response.display.conflict && (
              <div
                className="flex items-start gap-2 rounded-lg px-3 py-2"
                style={{ backgroundColor: "var(--urgent-bg)" }}
              >
                <span className="text-base mt-0.5">⚠</span>
                <p className="text-sm font-medium" style={{ color: "var(--urgent)" }}>
                  {response.display.conflict}
                </p>
              </div>
            )}

            {/* Alternative suggestion */}
            {response.display.alternative && (
              <div
                className="flex items-center gap-2 rounded-lg px-3 py-2"
                style={{ backgroundColor: "var(--well-bg)" }}
              >
                <span className="text-base">✓</span>
                <div>
                  <p className="text-[11px] font-medium" style={{ color: "var(--well)" }}>
                    Suggested alternative
                  </p>
                  <p className="text-sm font-bold" style={{ color: "var(--well)" }}>
                    {response.display.alternative}
                  </p>
                </div>
              </div>
            )}

            {/* Detail paragraph */}
            {response.display.detail && (
              <p className="text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                {response.display.detail}
              </p>
            )}

            {/* Action buttons */}
            {response.actions?.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {response.actions.map((action, i) => (
                  <button
                    key={i}
                    onClick={() => onAction?.(action)}
                    className="text-sm font-medium px-4 py-1.5 rounded-lg transition-opacity hover:opacity-80"
                    style={{ backgroundColor: "var(--primary)", color: "white" }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}

            {/* Evidence footer */}
            {response.evidence?.source && (
              <div
                className="flex items-center justify-between pt-2 border-t"
                style={{ borderColor: "var(--surface-sunk)" }}
              >
                <p className="text-[11px]" style={{ color: "var(--ink-faint)" }}>
                  Source: {response.evidence.source}
                </p>
                <div className="flex items-center gap-2">
                  <ConfidenceBadge confidence={response.evidence.confidence} />
                  {response.evidence.grounding_score != null && (
                    <span className="text-[10px] font-mono-num" style={{ color: "var(--ink-faint)" }}>
                      {(response.evidence.grounding_score * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
