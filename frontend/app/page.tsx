"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { getHousehold, post, postVoiceConfirm, postCareNotify } from "@/lib/api";
import { useTwinStore } from "@/lib/store";
import { ResponseEnvelope } from "@/lib/types";
import { useVoice } from "@/hooks/useVoice";
import MemberRail from "@/components/MemberRail";
import Constellation from "@/components/Constellation";
import VoiceOrb from "@/components/VoiceOrb";
import VerdictCard from "@/components/VerdictCard";
import VoicePanel from "@/components/VoicePanel";
import ChatPanel from "@/components/ChatPanel";

type ViewMode = "chat" | "visual";

export default function Home() {
  const {
    household,
    activeMember,
    orbState,
    lastResponse,
    transcript,
    notifications,
    messages,
    setHousehold,
    setActiveMember,
    setOrbState,
    setLastResponse,
    setTranscript,
    addNotification,
    dismissNotification,
    addMessage,
    clearMessages,
  } = useTwinStore();

  const [viewMode, setViewMode] = useState<ViewMode>("chat");
  const speakTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProcessing = orbState === "thinking" || orbState === "speaking";

  // ── Load household on mount ────────────────────────────────────────────────
  useEffect(() => {
    getHousehold().then((data) => {
      if (data) setHousehold(data);
    });
  }, [setHousehold]);

  // ── Core command handler ───────────────────────────────────────────────────
  const handleCommand = useCallback(
    async (inputTranscript: string, lang: "en" | "bn") => {
      if (!inputTranscript.trim() || isProcessing) return;
      setTranscript(inputTranscript);
      setOrbState("thinking");

      // Add user message to chat history
      addMessage({
        id: `u-${Date.now()}`,
        role: "user",
        text: inputTranscript,
        timestamp: Date.now(),
      });

      const data = await post("/api/voice/command", {
        transcript: inputTranscript,
        language: lang,
      });

      if (data) {
        const envelope = data as ResponseEnvelope;
        setLastResponse(envelope);
        setOrbState("speaking");

        // Add assistant message to chat history
        addMessage({
          id: `a-${Date.now()}`,
          role: "assistant",
          text: envelope.spoken,
          envelope,
          timestamp: Date.now(),
        });

        const utterance = speak(envelope.spoken, (envelope.language as "en" | "bn") ?? lang);
        if (utterance) {
          speakTimeoutRef.current = setTimeout(() => setOrbState("idle"), 8000);
          utterance.onend = () => {
            if (speakTimeoutRef.current) {
              clearTimeout(speakTimeoutRef.current);
              speakTimeoutRef.current = null;
            }
            setOrbState("idle");
          };
        } else {
          const wordCount = envelope.spoken.split(" ").length;
          setTimeout(() => setOrbState("idle"), Math.max(2500, wordCount * 350));
        }
      } else {
        setOrbState("error");
        setTimeout(() => setOrbState("idle"), 2000);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isProcessing, setOrbState, setLastResponse, setTranscript, addMessage]
  );

  // ── Voice hook ─────────────────────────────────────────────────────────────
  const { isListening, isSTTSupported, startListening, stopListening, speak } =
    useVoice({
      onTranscript: handleCommand,
      onError: () => {
        setOrbState("error");
        setTimeout(() => setOrbState("idle"), 2000);
      },
      onListeningEnd: () => {
        if (useTwinStore.getState().orbState === "listening") setOrbState("idle");
      },
    });

  // ── Orb click ──────────────────────────────────────────────────────────────
  function handleOrbClick() {
    if (isProcessing) return;
    if (orbState === "listening") {
      stopListening();
      setOrbState("idle");
    } else {
      setOrbState("listening");
      startListening("en");
    }
  }

  function handleMicClick(lang: "en" | "bn") {
    if (isProcessing) return;
    if (orbState === "listening") {
      stopListening();
      setOrbState("idle");
    } else {
      setOrbState("listening");
      startListening(lang);
    }
  }

  // ── Action handler ─────────────────────────────────────────────────────────
  async function handleAction(action: {
    type: string;
    label: string;
    target: string | null;
    pending_id?: string;
  }) {
    if (action.type === "notify_caregiver" && action.target) {
      const result = await postCareNotify(action.target, "Safety alert from HealthTwin");
      if (result?.notification) {
        addNotification(result.notification);
        const msg = `Notifying ${action.target}.`;
        setOrbState("speaking");
        speak(msg, "en");
        setTimeout(() => setOrbState("idle"), 2500);
      } else {
        setOrbState("error");
        setTimeout(() => setOrbState("idle"), 2000);
      }
    }
    if (action.pending_id) {
      const result = await postVoiceConfirm(action.pending_id, true);
      if (result) {
        setLastResponse(result);
        if ((result as { household_refresh?: boolean }).household_refresh) {
          const fresh = await getHousehold();
          if (fresh) setHousehold(fresh);
        }
        if (result.spoken) {
          const utterance = speak(result.spoken, (result.language as "en" | "bn") ?? "en");
          if (utterance) utterance.onend = () => setOrbState("idle");
          else setTimeout(() => setOrbState("idle"), 2500);
        }
      }
    }
  }

  const members = household?.members ?? [];
  const focusedMember = lastResponse?.member_focus ?? null;
  const alertMembers = lastResponse?.display.members ?? [];

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ backgroundColor: "var(--canvas)" }}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between px-5 py-3 shrink-0 z-20"
        style={{
          backgroundColor: "var(--primary)",
          borderBottom: "1px solid var(--primary-deep)",
        }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shadow"
            style={{ backgroundColor: "var(--accent)", color: "white" }}
          >
            HT
          </div>
          <div>
            <h1 className="text-sm font-bold leading-tight text-white tracking-wide">
              HealthTwin
            </h1>
            <p className="text-[10px]" style={{ color: "var(--primary-tint)" }}>
              Family Command Center
            </p>
          </div>
        </div>

        {/* Center: View toggle */}
        <div
          className="flex items-center rounded-xl p-0.5 gap-0.5"
          style={{ backgroundColor: "var(--primary-deep)" }}
        >
          {(["chat", "visual"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className="text-xs font-semibold px-4 py-1.5 rounded-lg transition-all capitalize"
              style={{
                backgroundColor: viewMode === mode ? "var(--accent)" : "transparent",
                color: viewMode === mode ? "white" : "var(--primary-tint)",
              }}
            >
              {mode === "chat" ? "💬 Chat" : "🌐 Visual"}
            </button>
          ))}
        </div>

        {/* Right: status */}
        <div className="flex items-center gap-2">
          {isSTTSupported ? (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "var(--well-bg)", color: "var(--well)" }}
            >
              Voice ready
            </span>
          ) : (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "var(--watch-bg)", color: "var(--watch)" }}
            >
              Text-only
            </span>
          )}
          {household && (
            <span
              className="text-[10px] px-2.5 py-1 rounded-full hidden sm:block"
              style={{ backgroundColor: "var(--primary-deep)", color: "var(--primary-tint)" }}
            >
              {household.name}
            </span>
          )}
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="text-[10px] px-2 py-0.5 rounded-full transition-opacity hover:opacity-70"
              style={{ backgroundColor: "var(--primary-deep)", color: "var(--primary-tint)" }}
            >
              Clear
            </button>
          )}
        </div>
      </header>

      {/* ── Notifications ───────────────────────────────────────────────────── */}
      {notifications.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-xs">
          {notifications.map((n) => (
            <div
              key={n.id}
              className="flex items-start gap-2 rounded-xl px-4 py-3 shadow-xl"
              style={{ backgroundColor: "var(--primary)", color: "white" }}
            >
              <span className="text-xs mt-0.5">🔔</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold">→ {n.target}</p>
                <p className="text-[11px] opacity-80 truncate">{n.message}</p>
              </div>
              <button
                onClick={() => dismissNotification(n.id)}
                className="text-[11px] opacity-60 hover:opacity-100 shrink-0"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">

        {/* Left: Member Rail */}
        <div
          className="hidden md:flex md:flex-col w-56 shrink-0 overflow-y-auto"
          style={{ borderRight: "1px solid var(--surface-sunk)" }}
        >
          {members.length > 0 ? (
            <MemberRail members={members} activeMember={activeMember} onSelect={setActiveMember} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-xs" style={{ color: "var(--ink-faint)" }}>Loading family…</p>
            </div>
          )}
        </div>

        {/* ── CHAT MODE ───────────────────────────────────────────────────── */}
        {viewMode === "chat" && (
          <>
            {/* Center: Orb + Chat History */}
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">

              {/* Compact Orb bar */}
              <div
                className="flex items-center justify-between px-5 py-2 shrink-0"
                style={{ borderBottom: "1px solid var(--surface-sunk)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="scale-[0.55] origin-left">
                    <VoiceOrb onClick={handleOrbClick} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: "var(--ink)" }}>
                      {orbState === "listening" && "Listening…"}
                      {orbState === "thinking" && "Processing…"}
                      {orbState === "speaking" && "Speaking…"}
                      {orbState === "error" && "Error — try again"}
                      {orbState === "idle" && (isListening ? "Listening…" : "Ready")}
                    </p>
                    {transcript && (
                      <p className="text-[10px] italic truncate max-w-[200px]"
                        style={{ color: "var(--ink-faint)" }}>
                        &ldquo;{transcript}&rdquo;
                      </p>
                    )}
                  </div>
                </div>
                {focusedMember && (
                  <span
                    className="text-[10px] px-2.5 py-1 rounded-full font-medium"
                    style={{ backgroundColor: "var(--accent-glow)", color: "var(--accent-deep)" }}
                  >
                    Focus: {focusedMember}
                  </span>
                )}
              </div>

              {/* Chat history */}
              <div className="flex-1 overflow-hidden">
                <ChatPanel
                  messages={messages}
                  isThinking={orbState === "thinking"}
                  onExampleClick={(t) => handleCommand(t, "en")}
                />
              </div>

              {/* Voice Panel */}
              <div
                className="shrink-0 px-4 pb-4 pt-3"
                style={{ borderTop: "1px solid var(--surface-sunk)" }}
              >
                <VoicePanel
                  onSubmit={handleCommand}
                  isListening={isListening}
                  isSTTSupported={isSTTSupported}
                  onMicClick={handleMicClick}
                  disabled={isProcessing}
                />
              </div>
            </div>

            {/* Right: Verdict Card */}
            <div
              className="hidden lg:flex flex-col w-80 shrink-0 overflow-y-auto p-4 gap-3"
              style={{ borderLeft: "1px solid var(--surface-sunk)" }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: "var(--ink-faint)" }}>
                Latest Verdict
              </p>
              <VerdictCard
                response={lastResponse as ResponseEnvelope | null}
                onAction={handleAction}
              />
            </div>
          </>
        )}

        {/* ── VISUAL MODE ─────────────────────────────────────────────────── */}
        {viewMode === "visual" && (
          <>
            {/* Center: Living Twin */}
            <div className="flex-1 flex flex-col items-center justify-between py-4 md:py-6 px-4 overflow-hidden min-h-0">
              <div className="flex-1 flex flex-col items-center justify-center min-h-0">
                <div className="relative">
                  {members.length > 0 && (
                    <Constellation
                      members={members}
                      focusedMember={focusedMember}
                      activeMember={activeMember}
                      alertMembers={alertMembers}
                      onSelect={setActiveMember}
                    />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <VoiceOrb onClick={handleOrbClick} />
                  </div>
                </div>
              </div>

              {transcript && (
                <p className="text-xs text-center px-4 mb-2 italic max-w-xs truncate"
                  style={{ color: "var(--ink-faint)" }}>
                  &ldquo;{transcript}&rdquo;
                </p>
              )}

              <div
                className="w-full max-w-lg rounded-2xl p-4"
                style={{ backgroundColor: "var(--surface)", border: "1px solid var(--surface-sunk)" }}
              >
                <VoicePanel
                  onSubmit={handleCommand}
                  isListening={isListening}
                  isSTTSupported={isSTTSupported}
                  onMicClick={handleMicClick}
                  disabled={isProcessing}
                />
              </div>
            </div>

            {/* Right: Verdict Panel */}
            <div
              className="verdict-panel-mobile md:w-80 md:shrink-0 md:overflow-y-auto p-4"
              style={{ borderTop: "1px solid var(--surface-sunk)" }}
            >
              <h2
                className="text-[10px] font-semibold uppercase tracking-widest mb-3 md:block hidden"
                style={{ color: "var(--ink-faint)" }}
              >
                Verdict
              </h2>
              <VerdictCard
                response={lastResponse as ResponseEnvelope | null}
                onAction={handleAction}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
