"use client";
import { useState, KeyboardEvent } from "react";
import { motion } from "framer-motion";

const DEMO_PROMPTS = [
  { label: "Baba ibuprofen?", full: "Can I give Baba ibuprofen for back pain?" },
  { label: "বাবার ব্যথা", full: "বাবার পিঠে ব্যথা, কী ওষুধ দেব?" },
  { label: "Add Losartan", full: "Add Losartan 50 to Ma" },
  { label: "Family status", full: "How many family members do we have?" },
];

interface Props {
  onSubmit: (transcript: string, lang: "en" | "bn") => void;
  isListening: boolean;
  isSTTSupported: boolean;
  onMicClick: (lang: "en" | "bn") => void;
  onAttachClick?: () => void;
  disabled?: boolean;
}

export default function VoicePanel({
  onSubmit,
  isListening,
  isSTTSupported,
  onMicClick,
  onAttachClick,
  disabled = false,
}: Props) {
  const [text, setText] = useState("");
  const [lang, setLang] = useState<"en" | "bn">("en");

  function handleSubmit(transcript: string) {
    const trimmed = transcript.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed, lang);
    setText("");
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSubmit(text);
  }

  const hasText = text.trim().length > 0;

  return (
    <div className="flex flex-col gap-2.5 w-full">
      {/* Quick chips */}
      <div className="flex flex-wrap gap-1.5">
        {DEMO_PROMPTS.map((p) => (
          <button
            key={p.full}
            onClick={() => handleSubmit(p.full)}
            disabled={disabled}
            className="text-[11px] px-3 py-1 rounded-full transition-all disabled:opacity-40 hover:scale-[1.03]"
            style={{
              background: "var(--glass)",
              border: "1px solid var(--border)",
              color: "var(--ink-soft)",
              backdropFilter: "blur(8px)",
            }}
            title={p.full}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Input row */}
      <div
        className="flex items-center gap-2 rounded-2xl px-3 py-2"
        style={{
          background: "var(--surface)",
          border: `1.5px solid ${isListening ? "var(--accent)" : "var(--border)"}`,
          transition: "border-color 0.2s, box-shadow 0.2s",
          boxShadow: isListening ? "0 0 0 3px rgba(226,146,47,0.16)" : "var(--shadow-sm)",
        }}
      >
        {/* Language toggle */}
        <button
          onClick={() => setLang(lang === "en" ? "bn" : "en")}
          disabled={disabled}
          className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg transition-all disabled:opacity-40"
          style={{
            background: lang === "bn" ? "var(--accent)" : "var(--surface-sunk)",
            color: lang === "bn" ? "var(--primary-deep)" : "var(--ink-soft)",
          }}
          title="Toggle language"
        >
          {lang === "en" ? "EN" : "বাং"}
        </button>

        {/* Mic button */}
        {isSTTSupported && (
          <motion.button
            onClick={() => onMicClick(lang)}
            disabled={disabled}
            className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center disabled:opacity-40"
            style={{
              background: isListening ? "var(--accent)" : "var(--surface-sunk)",
              boxShadow: isListening ? "0 2px 10px rgba(226,146,47,0.45)" : "none",
            }}
            whileTap={{ scale: 0.92 }}
            animate={isListening ? { scale: [1, 1.1, 1] } : { scale: 1 }}
            transition={isListening ? { duration: 0.9, repeat: Infinity } : {}}
            title={isListening ? "Stop listening" : "Start voice input"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke={isListening ? "#fff" : "var(--ink-soft)"}
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="2" width="6" height="11" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </motion.button>
        )}

        {/* Attach button */}
        {onAttachClick && (
          <button
            onClick={onAttachClick}
            disabled={disabled}
            className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors disabled:opacity-40"
            style={{ color: "var(--ink-soft)" }}
            title="Attach report or prescription"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
        )}

        {/* Text input */}
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          disabled={disabled}
          placeholder={
            isListening
              ? "Listening…"
              : lang === "bn"
              ? "বলুন বা টাইপ করুন…"
              : "Ask about medications, symptoms…"
          }
          className="flex-1 text-sm bg-transparent outline-none disabled:opacity-50"
          style={{
            color: "var(--ink)",
            fontFamily: lang === "bn" ? "'Hind Siliguri', sans-serif" : undefined,
          }}
        />

        {/* Send button */}
        <motion.button
          onClick={() => handleSubmit(text)}
          disabled={!hasText || disabled}
          className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center disabled:opacity-30 transition-all"
          style={{
            background: hasText && !disabled
              ? "linear-gradient(135deg, var(--primary), var(--primary-deep))"
              : "var(--surface-sunk)",
            boxShadow: hasText && !disabled ? "0 3px 12px rgba(15,76,85,0.25)" : "none",
          }}
          whileTap={{ scale: 0.9 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke={hasText ? "var(--canvas)" : "var(--ink-soft)"}
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </motion.button>
      </div>
    </div>
  );
}
