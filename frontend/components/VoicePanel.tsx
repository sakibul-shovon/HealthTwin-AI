"use client";
import { useState, KeyboardEvent } from "react";
import { motion } from "framer-motion";
import { useTwinStore } from "@/lib/store";
import { post } from "@/lib/api";
import { ResponseEnvelope } from "@/lib/types";

const DEMO_PROMPTS = [
  "Can I give Baba ibuprofen for back pain?",
  "বাবার পিঠে ব্যথা, কী ওষুধ দেব?",
  "Add Losartan 50 to Ma",
  "How many family members do we have?",
];

export default function VoicePanel() {
  const [text, setText] = useState("");
  const [lang, setLang] = useState<"en" | "bn">("en");
  const { setOrbState, setLastResponse, setTranscript } = useTwinStore();

  async function submit(transcript: string) {
    if (!transcript.trim()) return;
    setTranscript(transcript);
    setOrbState("thinking");

    const data = await post("/api/voice/command", { transcript, language: lang });
    if (data) {
      const envelope = data as ResponseEnvelope;
      setLastResponse(envelope);
      setOrbState("speaking");
      // Reset to idle after a beat
      setTimeout(() => setOrbState("idle"), 2500);
    } else {
      setOrbState("error");
      setTimeout(() => setOrbState("idle"), 2000);
    }
    setText("");
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") submit(text);
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Demo prompt chips */}
      <div className="flex flex-wrap gap-1.5">
        {DEMO_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => submit(p)}
            className="text-[11px] px-2.5 py-1 rounded-full transition-opacity hover:opacity-80 truncate max-w-[200px]"
            style={{ backgroundColor: "var(--primary-tint)", color: "var(--primary-deep)" }}
            title={p}
          >
            {p.length > 30 ? p.slice(0, 28) + "…" : p}
          </button>
        ))}
      </div>

      {/* Input row */}
      <div className="flex items-center gap-2">
        {/* Language toggle */}
        <button
          onClick={() => setLang(lang === "en" ? "bn" : "en")}
          className="shrink-0 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors"
          style={{
            backgroundColor: lang === "bn" ? "var(--accent)" : "var(--surface-sunk)",
            color: lang === "bn" ? "white" : "var(--ink-soft)",
          }}
          title="Toggle language"
        >
          {lang === "en" ? "EN" : "বাং"}
        </button>

        {/* Text input */}
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder={lang === "bn" ? "বলুন বা টাইপ করুন…" : "Speak or type a command…"}
          className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none transition-shadow"
          style={{
            backgroundColor: "var(--surface)",
            border: "1.5px solid var(--surface-sunk)",
            color: "var(--ink)",
            fontFamily: lang === "bn" ? "'Hind Siliguri', sans-serif" : undefined,
          }}
        />

        {/* Send button */}
        <motion.button
          onClick={() => submit(text)}
          className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: text.trim() ? "var(--primary)" : "var(--surface-sunk)" }}
          whileTap={{ scale: 0.92 }}
          disabled={!text.trim()}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </motion.button>
      </div>
    </div>
  );
}
