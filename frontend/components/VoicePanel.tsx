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
  disabled?: boolean;
}

export default function VoicePanel({
  onSubmit,
  isListening,
  isSTTSupported,
  onMicClick,
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

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Demo prompt chips */}
      <div className="flex flex-wrap gap-1.5">
        {DEMO_PROMPTS.map((p) => (
          <button
            key={p.full}
            onClick={() => handleSubmit(p.full)}
            disabled={disabled}
            className="text-[11px] px-2.5 py-1 rounded-full transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ backgroundColor: "var(--primary-tint)", color: "var(--primary-deep)" }}
            title={p.full}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Input row */}
      <div className="flex items-center gap-2">
        {/* Language toggle */}
        <button
          onClick={() => setLang(lang === "en" ? "bn" : "en")}
          disabled={disabled}
          className="shrink-0 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40"
          style={{
            backgroundColor: lang === "bn" ? "var(--accent)" : "var(--surface-sunk)",
            color: lang === "bn" ? "white" : "var(--ink-soft)",
          }}
          title="Toggle language (EN / বাংলা)"
        >
          {lang === "en" ? "EN" : "বাং"}
        </button>

        {/* Mic button (only when STT supported) */}
        {isSTTSupported && (
          <motion.button
            onClick={() => onMicClick(lang)}
            disabled={disabled}
            className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors disabled:opacity-40"
            style={{
              backgroundColor: isListening ? "var(--accent)" : "var(--surface-sunk)",
            }}
            whileTap={{ scale: 0.92 }}
            animate={isListening ? { scale: [1, 1.1, 1] } : { scale: 1 }}
            transition={isListening ? { duration: 0.8, repeat: Infinity } : {}}
            title={isListening ? "Stop listening" : "Start voice input"}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke={isListening ? "white" : "var(--ink-soft)"}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="2" width="6" height="11" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </motion.button>
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
              : "Speak or type a command…"
          }
          className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none transition-all disabled:opacity-50"
          style={{
            backgroundColor: "var(--surface)",
            border: `1.5px solid ${isListening ? "var(--accent)" : "var(--surface-sunk)"}`,
            color: "var(--ink)",
            fontFamily: lang === "bn" ? "'Hind Siliguri', sans-serif" : undefined,
          }}
        />

        {/* Send button */}
        <motion.button
          onClick={() => handleSubmit(text)}
          disabled={!text.trim() || disabled}
          className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-40"
          style={{
            backgroundColor: text.trim() && !disabled ? "var(--primary)" : "var(--surface-sunk)",
          }}
          whileTap={{ scale: 0.92 }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </motion.button>
      </div>
    </div>
  );
}
