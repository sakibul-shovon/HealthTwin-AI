"use client";

import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTwinStore } from "@/lib/store";
import { useVoiceCommand } from "@/lib/VoiceCommandContext";
import {
  postCareNotify, postVoiceConfirm, getHousehold,
  getSessions, createSession, deleteSession, renameSession, getSessionMessages,
} from "@/lib/api";
import { ChatMessage, ChatSession, ResponseEnvelope } from "@/lib/types";
import {
  AlertTriangle, ShieldAlert, Info, ShieldCheck, X,
  Plus, Trash2, MessageSquare, Pencil,
} from "lucide-react";

// ── Verdict badge ─────────────────────────────────────────────────────────────
const VERDICT_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  SAFE:      { bg: "var(--well-bg)",    color: "var(--well)",    label: "Safe" },
  CAUTION:   { bg: "var(--watch-bg)",   color: "var(--watch)",   label: "Caution" },
  UNSAFE:    { bg: "var(--urgent-bg)",  color: "var(--urgent)",  label: "Unsafe" },
  EMERGENCY: { bg: "var(--urgent-bg)",  color: "var(--urgent)",  label: "Emergency" },
  INFO:      { bg: "var(--info-bg)",    color: "var(--info)",    label: "Info" },
  CONFIRMED: { bg: "var(--well-bg)",    color: "var(--well)",    label: "Confirmed" },
  CLARIFY:   { bg: "var(--info-bg)",    color: "var(--info)",    label: "Clarify" },
};

function VerdictBadge({ verdict }: { verdict: string | null | undefined }) {
  if (!verdict) return null;
  const s = VERDICT_STYLE[verdict] ?? { bg: "var(--info-bg)", color: "var(--info)", label: verdict };
  return (
    <span
      className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
}

// ── Samantha message ──────────────────────────────────────────────────────────
function SamanthaMessage({ message, onAction }: { message: ChatMessage; onAction: (a: any) => void }) {
  const [showTrace, setShowTrace] = useState(false);
  const env = message.envelope;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 max-w-2xl">
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs text-white shrink-0 mt-0.5"
        style={{ background: "linear-gradient(135deg, var(--primary), var(--accent))", boxShadow: "0 1px 8px rgba(15,76,85,0.18)" }}
      >S</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[10px] font-bold" style={{ color: "var(--ink-soft)" }}>Samantha</span>
          {env?.verdict && <VerdictBadge verdict={env.verdict} />}
          {env?.member_focus && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: "var(--primary-tint)", color: "var(--primary)" }}>
              re: {env.member_focus}
            </span>
          )}
        </div>
        <div className="samantha-msg p-4" style={{ borderRadius: "0 16px 16px 16px" }}>
          <p className="text-sm leading-relaxed" style={{ color: "var(--ink)" }}>{message.text}</p>

          {env?.display?.conflict && (
            <div className="mt-3 pt-3 border-t" style={{ borderColor: "rgba(15,76,85,0.10)" }}>
              <p className="text-[11px] font-semibold" style={{ color: "var(--watch)" }}>⚠ {env.display.conflict}</p>
            </div>
          )}
          {env?.display?.alternative && (
            <p className="text-[11px] mt-1.5" style={{ color: "var(--ink-soft)" }}>Consider: {env.display.alternative}</p>
          )}

          {env?.actions && env.actions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t" style={{ borderColor: "rgba(15,76,85,0.08)" }}>
              {env.actions.map((action: any, i: number) => (
                <button key={i} onClick={() => onAction(action)}
                  className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
                  style={{ background: "var(--primary-tint)", color: "var(--primary)" }}>
                  {action.label}
                </button>
              ))}
            </div>
          )}

          {env?.gate1_trace && (
            <div className="mt-2">
              <button onClick={() => setShowTrace((v) => !v)}
                className="text-[10px] font-semibold transition-opacity hover:opacity-70"
                style={{ color: "var(--ink-faint)" }}>
                {showTrace ? "Hide" : "Why this verdict?"} ›
              </button>
              <AnimatePresence>
                {showTrace && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }} className="overflow-hidden mt-2">
                    <div className="text-[10px] rounded-lg p-2" style={{ background: "var(--surface-sunk)", color: "var(--ink-soft)" }}>
                      Verdict: {env.gate1_trace.verdict}
                      {env.gate1_trace.conflicts?.length > 0 && (
                        <div className="mt-1">
                          {env.gate1_trace.conflicts.map((c, i) => (
                            <div key={i}>• {c.type}: {c.detail}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
        <p className="text-[9px] mt-1 ml-1" style={{ color: "var(--ink-faint)" }}>
          {new Date(message.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </motion.div>
  );
}

// ── User message ──────────────────────────────────────────────────────────────
function UserMessage({ message }: { message: ChatMessage }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
      <div className="max-w-sm">
        <div className="user-msg px-4 py-2.5">
          <p className="text-sm" style={{ color: "var(--ink)" }}>{message.text}</p>
        </div>
        <p className="text-[9px] mt-1 mr-1 text-right" style={{ color: "var(--ink-faint)" }}>
          {new Date(message.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </motion.div>
  );
}

// ── Thinking dots ─────────────────────────────────────────────────────────────
function ThinkingIndicator() {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex gap-3 max-w-2xl">
      <div className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs text-white shrink-0"
        style={{ background: "linear-gradient(135deg, var(--primary), var(--accent))" }}>S</div>
      <div className="samantha-msg px-4 py-3" style={{ borderRadius: "0 16px 16px 16px" }}>
        <div className="flex gap-1.5 items-center h-5">
          {[0, 1, 2].map((i) => (
            <motion.div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--primary)" }}
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
              transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.22 }} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Session list item ─────────────────────────────────────────────────────────
function SessionItem({ session, active, onSelect, onDelete, onRename }: {
  session: ChatSession;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.title);

  function commitRename() {
    const t = draft.trim();
    if (t && t !== session.title) onRename(t);
    setEditing(false);
  }

  return (
    <div
      onClick={() => !editing && onSelect()}
      className="group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors"
      style={{
        background: active ? "var(--primary-tint)" : "transparent",
        color: active ? "var(--primary)" : "var(--ink-soft)",
      }}
    >
      <MessageSquare size={12} className="shrink-0 opacity-60" />
      {editing ? (
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setEditing(false); }}
          onClick={e => e.stopPropagation()}
          autoFocus
          className="flex-1 min-w-0 bg-transparent text-xs outline-none font-medium"
          style={{ color: "var(--ink)" }}
        />
      ) : (
        <span className="flex-1 min-w-0 text-xs font-medium truncate">{session.title}</span>
      )}
      <div
        className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={() => { setEditing(true); setDraft(session.title); }}
          className="p-1 rounded hover:opacity-60" title="Rename"
        ><Pencil size={10} /></button>
        <button
          onClick={onDelete}
          className="p-1 rounded hover:opacity-60"
          style={{ color: "var(--urgent)" }}
          title="Delete"
        ><Trash2 size={10} /></button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ConversationsPage() {
  const {
    messages, orbState, voiceEnabled,
    setOrbState, addNotification, setLastResponse, addMessage, setMessages, clearMessages,
    setHousehold, selectedFamilyMembers, clearFamilySelection, household,
    currentSessionId, setCurrentSessionId,
  } = useTwinStore();

  const { handleCommand, handleOrbClick, speak, isSTTSupported } = useVoiceCommand();
  const isProcessing = orbState === "thinking" || orbState === "speaking";

  const [text, setText] = useState("");
  const [lang, setLang] = useState<"en" | "bn">("en");
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const selectedMembers = (household?.members ?? []).filter(m => selectedFamilyMembers.includes(m.role_label));

  // Load session list on mount
  useEffect(() => { getSessions().then(setSessions); }, []);

  // Pre-fill from ?q= param (e.g. quick commands on Get Started page)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q && q.trim()) setText(q.trim());
  }, []);

  // Auto-scroll
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, orbState]);

  // ── Session actions ───────────────────────────────────────────────────────
  async function selectSession(id: number) {
    if (id === currentSessionId) return;
    setLoadingMsgs(true);
    setCurrentSessionId(id);
    clearMessages();
    const raw = await getSessionMessages(id, 100);
    const mapped = (raw as any[]).map(m => ({
      id: String(m.id),
      role: m.role as "user" | "assistant",
      text: m.text,
      envelope: m.envelope ?? undefined,
      timestamp: m.created_at ? new Date(m.created_at).getTime() : Date.now(),
    }));
    setMessages(mapped);
    setLoadingMsgs(false);
  }

  async function newChat() {
    const s = await createSession("New chat");
    if (!s) return;
    setSessions(prev => [s, ...prev]);
    setCurrentSessionId(s.id);
    clearMessages();
  }

  async function removeSession(id: number) {
    await deleteSession(id);
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) { setCurrentSessionId(null); clearMessages(); }
  }

  async function handleRename(id: number, title: string) {
    const updated = await renameSession(id, title);
    if (updated) setSessions(prev => prev.map(s => s.id === id ? { ...s, title } : s));
  }

  // Ensure a session exists before sending the first message
  async function ensureSession(): Promise<number | null> {
    if (currentSessionId) return currentSessionId;
    const s = await createSession("New chat");
    if (!s) return null;
    setSessions(prev => [s, ...prev]);
    setCurrentSessionId(s.id);
    return s.id;
  }

  // Auto-title on first user message
  useEffect(() => {
    if (!currentSessionId) return;
    const firstUser = messages.find(m => m.role === "user");
    if (!firstUser) return;
    const currentTitle = sessions.find(s => s.id === currentSessionId)?.title;
    if (currentTitle && currentTitle !== "New chat") return;
    const autoTitle = firstUser.text.slice(0, 45) + (firstUser.text.length > 45 ? "…" : "");
    handleRename(currentSessionId, autoTitle);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed || isProcessing) return;
    await ensureSession();
    handleCommand(trimmed, lang, false);
    setText("");
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSubmit();
  }

  // ── Actions (confirm writes, care notify) ─────────────────────────────────
  async function handleAction(action: any) {
    if (action.type === "notify_caregiver" && action.target) {
      const result = await postCareNotify(action.target, "Safety alert from Samantha");
      if (result?.notification) {
        addNotification(result.notification);
        setOrbState("speaking");
        setTimeout(() => setOrbState("idle"), 2500);
      } else {
        setOrbState("error");
        setTimeout(() => setOrbState("idle"), 2000);
      }
    } else if (action.pending_id) {
      const result = await postVoiceConfirm(action.pending_id, true);
      if (result) {
        const envelope = result as ResponseEnvelope;
        setLastResponse(envelope);
        addMessage({ id: `a-${Date.now()}`, role: "assistant", text: envelope.spoken, envelope, timestamp: Date.now() });
        if (envelope.household_refresh) {
          const fresh = await getHousehold();
          if (fresh) setHousehold(fresh);
        }
        if (envelope.spoken && voiceEnabled) {
          const handle = speak(envelope.spoken, (envelope.language as "en" | "bn") ?? "en");
          if (handle) handle.onend = () => setOrbState("idle");
          else setTimeout(() => setOrbState("idle"), 2500);
        } else {
          setTimeout(() => setOrbState("idle"), 1500);
        }
      }
    }
  }

  const hasText = text.trim().length > 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full min-h-0 overflow-hidden" style={{ background: "var(--canvas)" }}>

      {/* ── Sessions sidebar ─────────────────────────────────────────────── */}
      <div
        className="w-52 shrink-0 flex flex-col h-full border-r overflow-hidden"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        {/* New chat */}
        <div className="px-3 pt-4 pb-2 shrink-0">
          <button
            onClick={newChat}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ background: "var(--primary)", color: "#fff" }}
          >
            <Plus size={13} /> New chat
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto px-2 pb-4 flex flex-col gap-0.5 custom-scrollbar">
          {sessions.length === 0 ? (
            <p className="text-[10px] text-center mt-8" style={{ color: "var(--ink-faint)" }}>
              No chats yet
            </p>
          ) : sessions.map(s => (
            <SessionItem
              key={s.id}
              session={s}
              active={s.id === currentSessionId}
              onSelect={() => selectSession(s.id)}
              onDelete={() => removeSession(s.id)}
              onRename={title => handleRename(s.id, title)}
            />
          ))}
        </div>
      </div>

      {/* ── Chat area ────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 h-full min-h-0 overflow-hidden">

        {/* Header */}
        <div
          className="shrink-0 px-5 py-3 flex items-center gap-3 border-b"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <h1 className="text-sm font-bold flex-1 min-w-0 truncate" style={{ color: "var(--ink)" }}>
            {sessions.find(s => s.id === currentSessionId)?.title ?? "Conversations"}
          </h1>

          {/* Active member chips */}
          <AnimatePresence>
            {selectedMembers.length > 0 && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-1.5 shrink-0">
                {selectedMembers.map(m => (
                  <span key={m.id} className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "var(--primary-tint)", color: "var(--primary)" }}>
                    {m.display_name || m.role_label}
                  </span>
                ))}
                <button onClick={clearFamilySelection}
                  className="w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ background: "var(--border)", color: "var(--ink-soft)" }}>
                  <X size={8} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-6 flex flex-col gap-5">
          {loadingMsgs ? (
            <div className="flex-1 flex items-center justify-center">
              <motion.div className="w-5 h-5 rounded-full border-2 border-t-transparent"
                style={{ borderColor: "var(--primary)" }}
                animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
            </div>
          ) : messages.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex-1 flex flex-col items-center justify-center text-center py-12">
              <motion.div
                className="w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-2xl text-white mb-4"
                style={{ background: "linear-gradient(135deg, var(--primary), var(--accent))", boxShadow: "0 4px 20px rgba(15,76,85,0.20)" }}
                animate={{ scale: [1, 1.04, 1] }} transition={{ duration: 3, repeat: Infinity }}
              >S</motion.div>
              <h2 className="text-lg font-bold mb-2" style={{ color: "var(--ink)" }}>How can I help?</h2>
              <p className="text-sm max-w-xs" style={{ color: "var(--ink-soft)" }}>
                Ask about medications, family health, symptoms, or anything you need help with.
              </p>
              <div className="flex flex-wrap gap-2 mt-6 justify-center max-w-sm">
                {[
                  "Is metformin safe for Ma?",
                  "Can Child take aspirin?",
                  "Is naproxen safe for Baba?",
                  "বাবার ওষুধের তালিকা",
                ].map(q => (
                  <button key={q}
                    onClick={async () => { await ensureSession(); handleCommand(q, q.match(/[ঀ-৿]/) ? "bn" : "en", false); }}
                    className="text-xs px-3 py-1.5 rounded-full border transition-all hover:scale-[1.02]"
                    style={{ background: "var(--glass)", borderColor: "var(--border)", color: "var(--ink-soft)", backdropFilter: "blur(8px)" }}>
                    {q}
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            messages.map(msg =>
              msg.role === "assistant"
                ? <SamanthaMessage key={msg.id} message={msg} onAction={handleAction} />
                : <UserMessage key={msg.id} message={msg} />
            )
          )}

          <AnimatePresence>{orbState === "thinking" && <ThinkingIndicator />}</AnimatePresence>
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div className="shrink-0 px-4 py-3 border-t" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div
            className="flex items-center gap-2 rounded-2xl px-3 py-2.5"
            style={{ background: "var(--canvas)", border: "1.5px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
          >
            {/* Lang toggle */}
            <button
              onClick={() => setLang(l => l === "en" ? "bn" : "en")}
              disabled={isProcessing}
              className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg transition-all disabled:opacity-40"
              style={{ background: lang === "bn" ? "var(--accent)" : "var(--surface-sunk)", color: lang === "bn" ? "var(--primary-deep)" : "var(--ink-soft)" }}
            >
              {lang === "en" ? "EN" : "বাং"}
            </button>

            <input
              type="text" value={text} onChange={e => setText(e.target.value)} onKeyDown={onKey}
              disabled={isProcessing}
              placeholder={isProcessing ? "Samantha is responding…" : lang === "bn" ? "টাইপ করুন…" : "Type a message, or use the mic below…"}
              className="flex-1 text-sm bg-transparent outline-none disabled:opacity-50"
              style={{ color: "var(--ink)", fontFamily: lang === "bn" ? "'Hind Siliguri', sans-serif" : undefined }}
            />

            {/* Mic button */}
            {isSTTSupported && (
              <button onClick={handleOrbClick}
                className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
                style={{
                  background: orbState === "listening" ? "var(--accent)" : "var(--surface-sunk)",
                  color: orbState === "listening" ? "#fff" : "var(--ink-soft)",
                }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <rect x="9" y="2" width="6" height="11" rx="3" />
                  <path d="M5 10a7 7 0 0 0 14 0" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </button>
            )}

            {/* Send */}
            <motion.button
              onClick={handleSubmit}
              disabled={!hasText || isProcessing}
              className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center disabled:opacity-30 transition-all"
              style={{ background: hasText && !isProcessing ? "linear-gradient(135deg, var(--primary), var(--primary-deep))" : "var(--surface-sunk)" }}
              whileTap={{ scale: 0.9 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke={hasText && !isProcessing ? "white" : "var(--ink-soft)"}
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
