"use client";

import { useEffect, useCallback, useRef } from "react";
import { getHousehold, post, postVoiceConfirm, postCareNotify } from "@/lib/api";
import { useTwinStore } from "@/lib/store";
import { ResponseEnvelope } from "@/lib/types";
import { useVoice } from "@/hooks/useVoice";
import MemberRail from "@/components/MemberRail";
import Constellation from "@/components/Constellation";
import VoiceOrb from "@/components/VoiceOrb";
import VerdictCard from "@/components/VerdictCard";
import VoicePanel from "@/components/VoicePanel";

export default function Home() {
  const {
    household,
    activeMember,
    orbState,
    lastResponse,
    transcript,
    notifications,
    setHousehold,
    setActiveMember,
    setOrbState,
    setLastResponse,
    setTranscript,
    addNotification,
    dismissNotification,
  } = useTwinStore();

  // Used to cancel the 8s failsafe timeout when speech ends naturally (BUG-03)
  const speakTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isProcessing = orbState === "thinking" || orbState === "speaking";

  // ── Load household on mount ────────────────────────────────────────────────
  useEffect(() => {
    getHousehold().then((data) => {
      if (data) setHousehold(data);
    });
  }, [setHousehold]);

  // ── Core command handler (used by text input AND voice) ───────────────────
  const handleCommand = useCallback(
    async (inputTranscript: string, lang: "en" | "bn") => {
      if (!inputTranscript.trim() || isProcessing) return;
      setTranscript(inputTranscript);
      setOrbState("thinking");

      const data = await post("/api/voice/command", {
        transcript: inputTranscript,
        language: lang,
      });

      if (data) {
        const envelope = data as ResponseEnvelope;
        setLastResponse(envelope);
        setOrbState("speaking");

        // Speak the verdict
        const utterance = speak(envelope.spoken, (envelope.language as "en" | "bn") ?? lang);
        if (utterance) {
          // Failsafe clears itself when onend fires naturally (BUG-03)
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
    [isProcessing, setOrbState, setLastResponse, setTranscript]
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
        // Read current orbState from store (not closure) to avoid stale value (BUG-02)
        if (useTwinStore.getState().orbState === "listening") setOrbState("idle");
      },
    });

  // ── Orb click: toggle listening ────────────────────────────────────────────
  function handleOrbClick() {
    if (isProcessing) return;
    if (orbState === "listening") {
      stopListening();
      setOrbState("idle");
    } else {
      setOrbState("listening");
      // Use active language from the voice panel — default to 'en'
      startListening("en");
    }
  }

  // ── Mic button in VoicePanel ───────────────────────────────────────────────
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

  // ── Confirm action (e.g. "Notify Ma?" / "Confirm" write) ─────────────────
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
        // Re-fetch household so constellation + member rail reflect the write
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
      {/* ── Header ──────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between px-6 py-3 shrink-0"
        style={{
          backgroundColor: "var(--primary)",
          borderBottom: "1px solid var(--primary-deep)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
            style={{ backgroundColor: "var(--accent)", color: "white" }}
          >
            HT
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight text-white">
              HealthTwin
            </h1>
            <p className="text-[11px]" style={{ color: "var(--primary-tint)" }}>
              Family Command Center
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
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
              style={{
                backgroundColor: "var(--watch-bg)",
                color: "var(--watch)",
              }}
            >
              Text-only mode
            </span>
          )}
          {household && (
            <span
              className="text-xs px-2.5 py-1 rounded-full"
              style={{
                backgroundColor: "var(--primary-deep)",
                color: "var(--primary-tint)",
              }}
            >
              {household.name}
            </span>
          )}
        </div>
      </header>

      {/* ── Notification toasts ─────────────────────────────────── */}
      {notifications.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-xs">
          {notifications.map((n) => (
            <div
              key={n.id}
              className="flex items-start gap-2 rounded-xl px-4 py-3 shadow-lg"
              style={{ backgroundColor: "var(--primary)", color: "white" }}
            >
              <span className="text-xs mt-0.5">🔔</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold">Notification → {n.target}</p>
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

      {/* ── Body ────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Left: Member Rail — hidden on mobile */}
        <div
          className="hidden md:block w-56 shrink-0 overflow-y-auto"
          style={{ borderRight: "1px solid var(--surface-sunk)" }}
        >
          {members.length > 0 ? (
            <MemberRail
              members={members}
              activeMember={activeMember}
              onSelect={setActiveMember}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-xs" style={{ color: "var(--ink-faint)" }}>
                Loading family…
              </p>
            </div>
          )}
        </div>

        {/* Center: Living Twin */}
        <div className="flex-1 flex flex-col items-center justify-between py-4 md:py-6 px-4 overflow-hidden min-h-0">
          {/* Constellation + Orb */}
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
              {/* Orb floats in the constellation centre */}
              <div className="absolute inset-0 flex items-center justify-center">
                <VoiceOrb onClick={handleOrbClick} />
              </div>
            </div>
          </div>

          {/* Transcript hint */}
          {transcript && (
            <p
              className="text-xs text-center px-4 mb-2 italic max-w-xs truncate"
              style={{ color: "var(--ink-faint)" }}
            >
              &ldquo;{transcript}&rdquo;
            </p>
          )}

          {/* Voice Panel */}
          <div
            className="w-full max-w-lg rounded-2xl p-4"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--surface-sunk)",
            }}
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

        {/* Right: Verdict Panel — bottom sheet on mobile, sidebar on desktop */}
        <div
          className="verdict-panel-mobile md:w-80 md:shrink-0 md:overflow-y-auto p-4"
          style={{
            borderTop: "1px solid var(--surface-sunk)",
          }}
        >
          <h2
            className="text-xs font-semibold uppercase tracking-widest mb-3 md:block hidden"
            style={{ color: "var(--ink-faint)" }}
          >
            Verdict
          </h2>
          <VerdictCard
            response={lastResponse as ResponseEnvelope | null}
            onAction={handleAction}
          />
        </div>
      </div>
    </div>
  );
}
