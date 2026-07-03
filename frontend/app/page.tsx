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
    emergencyActive,
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
    getChatHistory().then((history: any[]) => {
      if (history && history.length > 0) {
        const clientMessages = history.map(msg => ({
          id: `db-${msg.id}`,
          role: msg.role as "user" | "assistant",
          text: msg.text,
          envelope: msg.envelope,
          timestamp: new Date(msg.created_at).getTime(),
        }));
        setMessages(clientMessages);
      }
    });
  }, [setHousehold, setMessages]);

  // ── Core command handler ───────────────────────────────────────────────────
  const handleCommand = useCallback(
    async (inputTranscript: string, lang: "en" | "bn") => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (!inputTranscript.trim()) return;
      
      // Clear speak timeout if barging in
      if (speakTimeoutRef.current) {
          clearTimeout(speakTimeoutRef.current);
          speakTimeoutRef.current = null;
      }
      
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
        if (envelope.verdict === "EMERGENCY") {
          setEmergency(true, envelope);
        }
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

  // ── Voice hook ─────────────────────────────────────────────────────────────
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

  // ── Orb click ──────────────────────────────────────────────────────────────
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
  const activeMemberId = members.find(m => m.role_label === activeMember)?.id;
  const focusedMember = lastResponse?.member_focus ?? null;
  const alertMembers = lastResponse?.display.members ?? [];

  const handleUploadSuccess = async (summary: string) => {
    // Refresh household so twins show new meds/conditions
    const fresh = await getHousehold();
    if (fresh) setHousehold(fresh);
    
    // Add success message
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
          member: activeMemberId ? members.find(m => m.id === activeMemberId)?.role_label ?? null : null,
          interpreted: "document upload",
        },
        evidence: { source: "System", confidence: "HIGH", grounding_score: null },
        actions: [],
        member_focus: null,
        language: "en"
      }
    });
  };

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ backgroundColor: "var(--canvas)" }}
    >
      <FamilyManager 
        isOpen={isManagerOpen} 
        onClose={() => setManagerOpen(false)} 
        initialMemberId={managerMemberId} 
      />
      {/* Emergency Mode Overlay */}
      <EmergencyMode onAction={handleAction} />

      {/* ── Mobile Twin Panel (bottom sheet, lg:hidden) ──────────────────── */}
      {mobilePanelOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 flex flex-col justify-end"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
          onClick={() => setMobilePanelOpen(false)}
        >
          <div
            className="rounded-t-2xl overflow-hidden flex flex-col"
            style={{ backgroundColor: "var(--surface)", maxHeight: "80vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 shrink-0"
              style={{ borderBottom: "1px solid var(--surface-sunk)" }}>
              <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>
                {activeMemberId ? "Member Twin" : "Family Constellation"}
              </p>
              <button
                onClick={() => setMobilePanelOpen(false)}
                className="text-xs px-2 py-1 rounded-lg"
                style={{ backgroundColor: "var(--surface-sunk)", color: "var(--ink-soft)" }}
                aria-label="Close panel"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {activeMemberId ? (
                <MemberTwin
                  memberId={activeMemberId}
                  onBack={() => { setActiveMember(null); }}
                  onEdit={handleOpenManager}
                />
              ) : (
                <div className="flex flex-col items-center p-4">
                  {members.length > 0 && (
                    <Constellation
                      members={members}
                      focusedMember={focusedMember}
                      activeMember={activeMember}
                      alertMembers={alertMembers}
                      verdict={lastResponse?.verdict ?? null}
                      onSelect={(label) => { setActiveMember(label); }}
                    />
                  )}
                  {lastResponse && (
                    <div className="w-full px-2 pb-4">
                      <VerdictCard response={lastResponse as ResponseEnvelope | null} onAction={handleAction} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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

        {/* Center: status chips */}
        <div className="flex items-center gap-2">
          {isSTTSupported ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "var(--well-bg)", color: "var(--well)" }}>
              Voice ready
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "var(--watch-bg)", color: "var(--watch)" }}>
              Text-only
            </span>
          )}
          {household && (
            <span className="text-[10px] px-2.5 py-1 rounded-full hidden sm:block"
              style={{ backgroundColor: "var(--primary-deep)", color: "var(--primary-tint)" }}>
              {household.name}
            </span>
          )}
        </div>

        {/* Right: mobile twin toggle + clear */}
        <div className="flex items-center gap-2">
          {/* Show constellation/twin panel on mobile */}
          <button
            onClick={() => setMobilePanelOpen(v => !v)}
            className="lg:hidden text-[10px] px-2.5 py-1 rounded-full transition-opacity hover:opacity-80"
            style={{ backgroundColor: "var(--accent)", color: "white" }}
            aria-label="Toggle family twin panel"
            aria-expanded={mobilePanelOpen}
          >
            {mobilePanelOpen ? "✕ Close" : "🏠 Twin"}
          </button>
          {messages.length > 0 && (
            <button onClick={() => { clearChatHistory(); clearMessages(); }}
              className="text-[10px] px-2 py-0.5 rounded-full transition-opacity hover:opacity-70"
              style={{ backgroundColor: "var(--primary-deep)", color: "var(--primary-tint)" }}
              aria-label="Clear chat history">
              Clear
            </button>
          )}
        </div>
      </header>

      {/* ── Notifications ───────────────────────────────────────────────────── */}
      {notifications.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-xs">
          {notifications.map((n) => (
            <div key={n.id} className="flex items-start gap-2 rounded-xl px-4 py-3 shadow-xl"
              style={{ backgroundColor: "var(--primary)", color: "white" }}>
              <span className="text-xs mt-0.5">🔔</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold">→ {n.target}</p>
                <p className="text-[11px] opacity-80 truncate">{n.message}</p>
              </div>
              <button onClick={() => dismissNotification(n.id)}
                className="text-[11px] opacity-60 hover:opacity-100 shrink-0">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* ── Body: permanent 3-column layout (D2) ────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: Member Rail */}
        <div className="hidden md:flex md:flex-col w-56 shrink-0 overflow-y-auto"
          style={{ borderRight: "1px solid var(--surface-sunk)" }}>
          {members.length > 0 ? (
            <MemberRail members={members} activeMember={activeMember} onSelect={setActiveMember} onOpenManager={handleOpenManager} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-xs" style={{ color: "var(--ink-faint)" }}>Loading family…</p>
            </div>
          )}
        </div>

        {/* Center: Chat + Orb + Voice input */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">

          <UploadDropzone ref={dropzoneRef} onUploadSuccess={handleUploadSuccess}>
            {/* Chat history */}
            <div className="flex-1 overflow-hidden">
              <ChatPanel
                messages={messages}
                isThinking={orbState === "thinking"}
                onExampleClick={(t) => handleCommand(t, "en")}
              />
            </div>
          </UploadDropzone>

          {/* ── Orb + status + voice input ────────────────────────────────── */}
          <div className="shrink-0 flex flex-col items-center gap-2 px-4 pb-4 pt-3"
            style={{ borderTop: "1px solid var(--surface-sunk)" }}>

            {/* Orb row: orb (md) + status text side-by-side */}
            <div className="flex items-center gap-4 w-full">
              <VoiceOrb size="md" onClick={handleOrbClick} />
              <div className="flex flex-col min-w-0 flex-1">
                <p className="text-sm font-semibold" style={{ color: "var(--ink)" }} aria-live="polite">
                  {orbState === "listening" && "Listening…"}
                  {orbState === "thinking" && "Processing your request…"}
                  {orbState === "speaking" && "Speaking…"}
                  {orbState === "error"    && "Didn't catch that — please try again"}
                  {orbState === "idle"     && (isListening ? "Listening…" : "Ready to listen")}
                </p>
                {transcript && (
                  <p className="text-[11px] italic truncate"
                    style={{ color: "var(--ink-faint)" }}>
                    &ldquo;{transcript}&rdquo;
                  </p>
                )}
                {focusedMember && (
                  <span className="text-[10px] mt-0.5 inline-flex items-center gap-1 font-medium w-fit px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: "var(--accent-glow)", color: "var(--accent-deep)" }}>
                    Focus: {focusedMember}
                  </span>
                )}
              </div>
            </div>

            {/* Voice panel (text input + chips) */}
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

        {/* Right: Twin panel — Constellation + Verdict (always visible) */}
        <div className="hidden lg:flex flex-col w-80 shrink-0 overflow-hidden bg-white z-10"
          style={{ borderLeft: "1px solid var(--surface-sunk)" }}>
          
          {activeMemberId ? (
            <MemberTwin memberId={activeMemberId} onBack={() => setActiveMember(null)} onEdit={handleOpenManager} />
          ) : (
            <div className="flex flex-col h-full overflow-y-auto">
              {/* Constellation */}
              <div className="flex items-center justify-center p-4 shrink-0">
                {members.length > 0 && (
                  <Constellation
                    members={members}
                    focusedMember={focusedMember}
                    activeMember={activeMember}
                    alertMembers={alertMembers}
                    verdict={lastResponse?.verdict ?? null}
                    onSelect={setActiveMember}
                  />
                )}
              </div>

              <div style={{ borderTop: "1px solid var(--surface-sunk)" }} />

              {/* Verdict or Overview */}
              {lastResponse ? (
                <div className="p-4 flex flex-col gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest"
                    style={{ color: "var(--ink-faint)" }}>
                    Latest Verdict
                  </p>
                  <VerdictCard
                    response={lastResponse as ResponseEnvelope | null}
                    onAction={handleAction}
                  />
                </div>
              ) : (
                <div className="p-6 flex flex-col items-center justify-center text-center gap-2 flex-1 opacity-70">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl shadow-inner mb-2"
                    style={{ backgroundColor: "var(--surface-sunk)", color: "var(--ink-faint)" }}>
                    🏠
                  </div>
                  <h3 className="text-sm font-bold" style={{ color: "var(--ink)" }}>{household?.name || "Family Overview"}</h3>
                  <p className="text-xs" style={{ color: "var(--ink-faint)" }}>{members.length} members tracked</p>
                  <p className="text-[10px] mt-4 max-w-[200px]" style={{ color: "var(--ink-faint)" }}>Select a member from the rail or constellation to view their AI digital twin.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
