"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { getHousehold, post, postVoiceConfirm, postCareNotify, getChatHistory, clearChatHistory } from "@/lib/api";
import { useTwinStore } from "@/lib/store";
import { ResponseEnvelope } from "@/lib/types";
import { useVoice } from "@/hooks/useVoice";
import MemberRail from "@/components/MemberRail";
import Constellation from "@/components/Constellation";
import VoiceOrb from "@/components/VoiceOrb";
import EmergencyMode from "@/components/EmergencyMode";
import MemberTwin from "@/components/MemberTwin";
import VerdictCard from "@/components/VerdictCard";
import VoicePanel from "@/components/VoicePanel";
import ChatPanel from "@/components/ChatPanel";
import UploadDropzone, { UploadDropzoneRef } from "@/components/UploadDropzone";
import FamilyManager from "@/components/FamilyManager";

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
    setMessages,
    clearMessages,
    setEmergency,
  } = useTwinStore();

  const speakTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropzoneRef = useRef<UploadDropzoneRef>(null);
  const isProcessing = orbState === "thinking" || orbState === "speaking";

  const [isManagerOpen, setManagerOpen] = useState(false);
  const [managerMemberId, setManagerMemberId] = useState<number | null>(null);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

  const handleOpenManager = (id?: number) => {
    setManagerMemberId(id || null);
    setManagerOpen(true);
  };

  // ── Load household & chat history on mount ────────────────────────────────
  useEffect(() => {
    getHousehold().then((data) => {
      if (data) setHousehold(data);
    });
    getChatHistory().then(
      (history: { id: number | string; role: string; text: string; envelope: ResponseEnvelope; created_at: string }[]) => {
        if (history && history.length > 0) {
          const clientMessages = history.map((msg) => ({
            id: `db-${msg.id}`,
            role: msg.role as "user" | "assistant",
            text: msg.text,
            envelope: msg.envelope,
            timestamp: new Date(msg.created_at).getTime(),
          }));
          setMessages(clientMessages);
        }
      }
    );
  }, [setHousehold, setMessages]);

  // ── Core command handler ──────────────────────────────────────────────────
  const handleCommand = useCallback(
    async (inputTranscript: string, lang: "en" | "bn") => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (!inputTranscript.trim()) return;

      if (speakTimeoutRef.current) {
        clearTimeout(speakTimeoutRef.current);
        speakTimeoutRef.current = null;
      }

      setTranscript(inputTranscript);
      setOrbState("thinking");

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
        if (envelope.verdict === "EMERGENCY") {
          setEmergency(true, envelope);
        }
        setLastResponse(envelope);
        setOrbState("speaking");

        addMessage({
          id: `a-${Date.now()}`,
          role: "assistant",
          text: envelope.spoken,
          envelope,
          timestamp: Date.now(),
        });

        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        const utterance = speak(envelope.spoken, (envelope.language as "en" | "bn") ?? lang);
        if (utterance) {
          speakTimeoutRef.current = setTimeout(() => {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            if (envelope.verdict === "CLARIFY" && isSTTSupported) {
              setOrbState("listening");
              // eslint-disable-next-line @typescript-eslint/no-use-before-define
              startListening(lang);
            } else {
              setOrbState("idle");
            }
          }, 8000);

          utterance.onend = () => {
            if (speakTimeoutRef.current) {
              clearTimeout(speakTimeoutRef.current);
              speakTimeoutRef.current = null;
            }
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            if (envelope.verdict === "CLARIFY" && isSTTSupported) {
              setOrbState("listening");
              // eslint-disable-next-line @typescript-eslint/no-use-before-define
              startListening(lang);
            } else {
              setOrbState("idle");
            }
          };
        } else {
          const wordCount = envelope.spoken.split(" ").length;
          setTimeout(() => {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            if (envelope.verdict === "CLARIFY" && isSTTSupported) {
              setOrbState("listening");
              // eslint-disable-next-line @typescript-eslint/no-use-before-define
              startListening(lang);
            } else {
              setOrbState("idle");
            }
          }, Math.max(2500, wordCount * 350));
        }
      } else {
        setOrbState("error");
        setTimeout(() => setOrbState("idle"), 2000);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setOrbState, setLastResponse, setTranscript, addMessage]
  );

  // ── Voice hook ────────────────────────────────────────────────────────────
  const { isListening, isSTTSupported, startListening, stopListening, speak, cancelSpeech } =
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

  // ── Orb click ─────────────────────────────────────────────────────────────
  function handleOrbClick() {
    cancelSpeech();
    if (speakTimeoutRef.current) {
      clearTimeout(speakTimeoutRef.current);
      speakTimeoutRef.current = null;
    }
    if (orbState === "listening") {
      stopListening();
      setOrbState("idle");
    } else {
      setOrbState("listening");
      startListening("en");
    }
  }

  function handleMicClick(lang: "en" | "bn") {
    cancelSpeech();
    if (speakTimeoutRef.current) {
      clearTimeout(speakTimeoutRef.current);
      speakTimeoutRef.current = null;
    }
    if (orbState === "listening") {
      stopListening();
      setOrbState("idle");
    } else {
      setOrbState("listening");
      startListening(lang);
    }
  }

  // ── Action handler ────────────────────────────────────────────────────────
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
  const activeMemberId = members.find((m) => m.role_label === activeMember)?.id;
  const focusedMember = lastResponse?.member_focus ?? null;
  const alertMembers = lastResponse?.display.members ?? [];

  const handleUploadSuccess = async (summary: string) => {
    const fresh = await getHousehold();
    if (fresh) setHousehold(fresh);

    addMessage({
      id: `system-${Date.now()}`,
      role: "assistant",
      text: summary,
      timestamp: Date.now(),
      envelope: {
        verdict: "CONFIRMED",
        spoken: summary,
        display: {
          title: "Document Saved",
          detail: summary,
          conflict: null,
          alternative: null,
          member: activeMemberId
            ? members.find((m) => m.id === activeMemberId)?.role_label ?? null
            : null,
          interpreted: "document upload",
        },
        evidence: { source: "System", confidence: "HIGH", grounding_score: null },
        actions: [],
        member_focus: null,
        language: "en",
      },
    });
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: "var(--canvas)" }}>
      <FamilyManager
        isOpen={isManagerOpen}
        onClose={() => setManagerOpen(false)}
        initialMemberId={managerMemberId}
      />
      <EmergencyMode onAction={handleAction} />

      {/* ── Mobile bottom sheet ──────────────────────────────────────────── */}
      {mobilePanelOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 flex flex-col justify-end"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => setMobilePanelOpen(false)}
        >
          <div
            className="rounded-t-3xl overflow-hidden flex flex-col"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              maxHeight: "82vh",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-5 py-3.5 shrink-0"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>
                {activeMemberId ? "Member Twin" : "Verdict & Conversation"}
              </p>
              <button
                onClick={() => setMobilePanelOpen(false)}
                className="text-xs px-2.5 py-1 rounded-lg"
                style={{ background: "var(--surface-sunk)", color: "var(--ink-soft)" }}
                aria-label="Close panel"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {activeMemberId ? (
                <MemberTwin
                  memberId={activeMemberId}
                  onBack={() => setActiveMember(null)}
                  onEdit={handleOpenManager}
                />
              ) : (
                <div className="flex flex-col p-4 gap-4">
                  <VerdictCard response={lastResponse as ResponseEnvelope | null} onAction={handleAction} />
                  <div className="min-h-[300px]">
                    <ChatPanel
                      messages={messages}
                      isThinking={orbState === "thinking"}
                      onExampleClick={(t) => { handleCommand(t, "en"); setMobilePanelOpen(false); }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between px-5 py-3 shrink-0 z-20"
        style={{
          background: "var(--glass)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs"
            style={{
              background: "linear-gradient(135deg, var(--primary), var(--accent))",
              color: "#fff",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            HT
          </div>
          <div>
            <h1
              className="text-sm font-bold leading-tight tracking-tight"
              style={{ color: "var(--ink)" }}
            >
              HealthTwin
            </h1>
            <p className="text-[10px] font-medium" style={{ color: "var(--ink-soft)" }}>
              Living family health twin
            </p>
          </div>
        </div>

        {/* Status chips */}
        <div className="flex items-center gap-2">
          {isSTTSupported ? (
            <span
              className="text-[10px] font-medium px-2.5 py-1 rounded-full"
              style={{ background: "var(--well-bg)", color: "var(--well)" }}
            >
              Voice ready
            </span>
          ) : (
            <span
              className="text-[10px] font-medium px-2.5 py-1 rounded-full"
              style={{ background: "var(--watch-bg)", color: "var(--watch)" }}
            >
              Text-only
            </span>
          )}
          {household && (
            <span
              className="text-[10px] font-medium px-2.5 py-1 rounded-full hidden sm:block"
              style={{ background: "var(--glass-bright)", border: "1px solid var(--border)", color: "var(--ink-soft)" }}
            >
              {household.name}
            </span>
          )}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobilePanelOpen((v) => !v)}
            className="lg:hidden text-[10px] font-medium px-2.5 py-1 rounded-full transition-all"
            style={{ background: "var(--primary-tint)", color: "var(--primary)" }}
            aria-label="Toggle family twin panel"
            aria-expanded={mobilePanelOpen}
          >
            {mobilePanelOpen ? "✕ Close" : "Twin"}
          </button>
          {messages.length > 0 && (
            <button
              onClick={() => { clearChatHistory(); clearMessages(); }}
              className="text-[10px] font-medium px-2.5 py-1 rounded-full transition-all hover:opacity-70"
              style={{ background: "var(--glass-bright)", border: "1px solid var(--border)", color: "var(--ink-soft)" }}
              aria-label="Clear chat history"
            >
              Clear
            </button>
          )}
        </div>
      </header>

      {/* ── Toast notifications ──────────────────────────────────────────── */}
      {notifications.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-xs">
          {notifications.map((n) => (
            <div
              key={n.id}
              className="flex items-start gap-2 rounded-2xl px-4 py-3 shadow-2xl glass-bright"
              style={{ border: "1px solid var(--primary)33" }}
            >
              <span className="text-xs mt-0.5">🔔</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold" style={{ color: "var(--ink)" }}>
                  → {n.target}
                </p>
                <p className="text-[11px] truncate" style={{ color: "var(--ink-soft)" }}>
                  {n.message}
                </p>
              </div>
              <button
                onClick={() => dismissNotification(n.id)}
                className="text-[11px] shrink-0 hover:opacity-70"
                style={{ color: "var(--ink-soft)" }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Body: 3-column layout ────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: icon-only member rail (72px) */}
        <div
          className="hidden md:flex md:flex-col overflow-y-auto overflow-x-visible shrink-0"
          style={{
            width: 72,
            background: "var(--surface)",
          }}
        >
          {members.length > 0 ? (
            <MemberRail
              members={members}
              activeMember={activeMember}
              onSelect={setActiveMember}
              onOpenManager={handleOpenManager}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 rounded-full animate-pulse" style={{ background: "var(--surface-sunk)" }} />
            </div>
          )}
        </div>

        {/* Center: the Living Twin hero + voice input */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <UploadDropzone ref={dropzoneRef} onUploadSuccess={handleUploadSuccess}>
            <div className="relative flex-1 flex flex-col items-center justify-center overflow-hidden dot-grid">
              {/* warm radial wash behind the twin */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(ellipse 55% 45% at 50% 46%, rgba(226,146,47,0.08) 0%, transparent 70%)",
                }}
              />

              {members.length > 0 ? (
                <Constellation
                  hero
                  members={members}
                  focusedMember={focusedMember}
                  activeMember={activeMember}
                  alertMembers={alertMembers}
                  verdict={lastResponse?.verdict ?? null}
                  onSelect={setActiveMember}
                  centerSlot={<VoiceOrb size="full" onClick={handleOrbClick} />}
                />
              ) : (
                <VoiceOrb size="full" onClick={handleOrbClick} />
              )}

              {/* Status + transcript line */}
              <div
                className="relative z-10 mt-1 flex flex-col items-center gap-1.5 px-6 text-center max-w-md"
                aria-live="polite"
              >
                <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                  {orbState === "listening" && "Listening…"}
                  {orbState === "thinking" && "Thinking…"}
                  {orbState === "speaking" && "Speaking…"}
                  {orbState === "error" && "Didn't catch that — try again"}
                  {orbState === "idle" && (isListening ? "Listening…" : "Ask about any family member")}
                </p>
                {transcript && (
                  <p className="text-xs italic" style={{ color: "var(--ink-soft)" }}>
                    &ldquo;{transcript}&rdquo;
                  </p>
                )}
                {focusedMember && (
                  <span
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{ background: "var(--primary-tint)", color: "var(--primary)" }}
                  >
                    Focus: {focusedMember}
                  </span>
                )}
              </div>
            </div>
          </UploadDropzone>

          {/* Voice input panel */}
          <div className="shrink-0 px-5 pb-5 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
            <VoicePanel
              onSubmit={handleCommand}
              isListening={isListening}
              isSTTSupported={isSTTSupported}
              onMicClick={handleMicClick}
              onAttachClick={() => dropzoneRef.current?.openFileDialog()}
              disabled={isProcessing}
            />
          </div>
        </div>

        {/* Right: latest verdict + conversation, or member twin */}
        <div
          className="hidden lg:flex flex-col w-96 shrink-0 overflow-hidden"
          style={{
            borderLeft: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          {activeMemberId ? (
            <MemberTwin
              memberId={activeMemberId}
              onBack={() => setActiveMember(null)}
              onEdit={handleOpenManager}
            />
          ) : (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Latest verdict */}
              <div className="shrink-0 p-4" style={{ borderBottom: "1px solid var(--border)" }}>
                <p
                  className="text-[10px] font-bold uppercase tracking-widest mb-2.5"
                  style={{ color: "var(--ink-soft)" }}
                >
                  Latest Verdict
                </p>
                <VerdictCard
                  response={lastResponse as ResponseEnvelope | null}
                  onAction={handleAction}
                />
              </div>

              {/* Conversation history */}
              <div className="flex-1 overflow-hidden min-h-0">
                <ChatPanel
                  messages={messages}
                  isThinking={orbState === "thinking"}
                  onExampleClick={(t) => handleCommand(t, "en")}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
