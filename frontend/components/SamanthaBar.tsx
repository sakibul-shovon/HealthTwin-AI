"use client";

import { useState, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTwinStore } from "@/lib/store";
import { useVoiceCommand } from "@/lib/VoiceCommandContext";

const STATE_CONFIG = {
  idle:      { label: "Ask Samantha…",  orbBg: "linear-gradient(135deg, var(--primary), var(--primary-deep))", ringColor: "transparent",              barBorder: "var(--border)" },
  listening: { label: "Listening…",     orbBg: "linear-gradient(135deg, var(--accent), #c97a1a)",              ringColor: "rgba(226,146,47,0.30)",    barBorder: "var(--accent)" },
  thinking:  { label: "Thinking…",      orbBg: "linear-gradient(135deg, var(--primary-deep), var(--primary))", ringColor: "rgba(15,76,85,0.20)",      barBorder: "var(--primary)" },
  speaking:  { label: "Speaking…",      orbBg: "linear-gradient(135deg, var(--well), #1e5e3e)",                ringColor: "rgba(46,125,91,0.20)",     barBorder: "var(--well)" },
  error:     { label: "Try again",      orbBg: "linear-gradient(135deg, var(--urgent), #8c2234)",              ringColor: "rgba(191,51,72,0.20)",     barBorder: "var(--urgent)" },
} as const;

function Waveform() {
  const delays = [0, 0.15, 0.30, 0.45, 0.60];
  return (
    <div className="flex items-end gap-[3px] h-4">
      {delays.map((d, i) => (
        <span
          key={i}
          className="samantha-wave-bar"
          style={{ animationDelay: `${d}s`, height: "16px", width: "3px", borderRadius: "2px", background: "var(--accent)" }}
        />
      ))}
    </div>
  );
}

export default function SamanthaBar() {
  const {
    orbState,
    voiceEnabled,
    toggleVoice,
    selectedFamilyMembers,
    clearFamilySelection,
    household,
  } = useTwinStore();

  const { handleCommand, handleOrbClick, isListening, isSTTSupported } = useVoiceCommand();

  const [showText, setShowText] = useState(false);
  const [text, setText] = useState("");
  const [lang, setLang] = useState<"en" | "bn">("en");

  const cfg = STATE_CONFIG[orbState];
  const isActive = orbState !== "idle" && orbState !== "error";

  const selectedMembers = (household?.members ?? []).filter((m) =>
    selectedFamilyMembers.includes(m.role_label)
  );

  function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    handleCommand(trimmed, lang, true);
    setText("");
    setShowText(false);
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSubmit();
    if (e.key === "Escape") { setShowText(false); setText(""); }
  }

  return (
    <div className="shrink-0 flex flex-col items-center pb-2 pt-1.5 px-4 gap-1.5">

      {/* Context chips */}
      <AnimatePresence>
        {selectedMembers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="flex items-center gap-1.5 flex-wrap justify-center"
          >
            <span className="text-[10px] font-semibold" style={{ color: "var(--ink-faint)" }}>Context:</span>
            {selectedMembers.map((m) => (
              <span key={m.id} className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "var(--primary-tint)", color: "var(--primary)" }}>
                {m.display_name || m.role_label}
              </span>
            ))}
            <button onClick={clearFamilySelection} className="text-[10px] font-bold hover:opacity-60"
              style={{ color: "var(--ink-faint)" }}>✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main pill ── */}
      <motion.div
        layout
        className="flex items-center gap-2 rounded-2xl px-2.5 py-2"
        style={{
          background: "var(--surface)",
          border: `1.5px solid ${isActive ? cfg.ringColor : cfg.barBorder}`,
          boxShadow: isActive
            ? `0 4px 24px ${cfg.ringColor}, var(--shadow-md)`
            : "var(--shadow-md)",
          maxWidth: 520,
          width: "100%",
          transition: "border-color 0.3s, box-shadow 0.3s",
        }}
      >
        {/* ── Voice ON/OFF toggle — most prominent control ── */}
        <motion.button
          onClick={toggleVoice}
          whileTap={{ scale: 0.94 }}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all"
          style={{
            background: voiceEnabled ? "var(--primary)" : "var(--surface-sunk)",
            color: voiceEnabled ? "#fff" : "var(--ink-soft)",
          }}
          title={voiceEnabled ? "Voice ON — click to mute" : "Voice OFF — click to enable"}
        >
          {voiceEnabled ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          )}
          <span className="text-[10px] font-bold">{voiceEnabled ? "Voice" : "Muted"}</span>
        </motion.button>

        {/* Divider */}
        <div className="w-px h-5 shrink-0" style={{ background: "var(--border)" }} />

        {/* ── Mic orb button ── */}
        <motion.button
          onClick={handleOrbClick}
          disabled={!isSTTSupported}
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 disabled:opacity-40"
          style={{ background: cfg.orbBg, boxShadow: isActive ? `0 2px 12px ${cfg.ringColor}` : "none" }}
          animate={
            orbState === "listening" ? { scale: [1, 1.12, 1] } :
            orbState === "thinking"  ? { rotate: [0, 360] } :
            orbState === "speaking"  ? { scale: [1, 1.05, 1] } : {}
          }
          transition={
            orbState === "listening" ? { duration: 0.85, repeat: Infinity } :
            orbState === "thinking"  ? { duration: 2, repeat: Infinity, ease: "linear" } :
            orbState === "speaking"  ? { duration: 1.4, repeat: Infinity } : {}
          }
          whileTap={{ scale: 0.9 }}
          title={isListening ? "Stop" : "Push to talk"}
        >
          {orbState === "listening" ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="white"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
          ) : orbState === "thinking" ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
            </svg>
          ) : orbState === "speaking" ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="white" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
              <rect x="9" y="2" width="6" height="11" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </motion.button>

        {/* Status / waveform / text input */}
        <div className="flex-1 min-w-0 flex items-center">
          <AnimatePresence mode="wait">
            {showText ? (
              <motion.input
                key="input"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                autoFocus
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKey}
                placeholder={lang === "bn" ? "টাইপ করুন…" : "Type a message…"}
                className="w-full bg-transparent text-sm outline-none"
                style={{ color: "var(--ink)", fontFamily: lang === "bn" ? "'Hind Siliguri', sans-serif" : undefined }}
              />
            ) : orbState === "listening" ? (
              <motion.div key="wave" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Waveform />
              </motion.div>
            ) : (
              <motion.button
                key="label"
                initial={{ opacity: 0, y: 2 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -2 }}
                onClick={() => setShowText(true)}
                className="text-sm text-left w-full hover:opacity-70 transition-opacity"
                style={{ color: isActive ? "var(--ink)" : "var(--ink-faint)" }}
              >
                {cfg.label}
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Lang toggle (text mode only) */}
        <AnimatePresence>
          {showText && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => setLang(lang === "en" ? "bn" : "en")}
              className="shrink-0 text-[10px] font-bold px-1.5 py-1 rounded-lg"
              style={{ background: lang === "bn" ? "var(--accent)" : "var(--surface-sunk)", color: lang === "bn" ? "var(--primary-deep)" : "var(--ink-soft)" }}
            >
              {lang === "en" ? "EN" : "বাং"}
            </motion.button>
          )}
        </AnimatePresence>

        {/* Send button (text mode + has text) */}
        <AnimatePresence>
          {showText && text.trim() && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
              onClick={handleSubmit}
              className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-deep))" }}
              whileTap={{ scale: 0.9 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Text mode toggle */}
        <motion.button
          onClick={() => setShowText((v) => !v)}
          whileTap={{ scale: 0.9 }}
          className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
          style={{ background: showText ? "var(--primary-tint)" : "transparent", color: showText ? "var(--primary)" : "var(--ink-faint)" }}
          title="Type a message"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M17 6H3" /><path d="M21 12H3" /><path d="M15 18H3" />
          </svg>
        </motion.button>
      </motion.div>

      {/* Voice on hint */}
      <AnimatePresence>
        {voiceEnabled && (
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="text-[9px] text-center flex items-center gap-1 justify-center"
            style={{ color: "var(--ink-faint)" }}
          >
            <span style={{ color: "var(--well)", fontSize: 7 }}>●</span>
            Samantha voice active
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
