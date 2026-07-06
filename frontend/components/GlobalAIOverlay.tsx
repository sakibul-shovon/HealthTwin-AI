"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTwinStore } from "@/lib/store";
import { post, postVoiceConfirm, postCareNotify, getHousehold, getChatHistory, getBriefing } from "@/lib/api";
import { ResponseEnvelope } from "@/lib/types";
import { useVoice } from "@/hooks/useVoice";
import VoiceOrb from "@/components/VoiceOrb";
import ChatPanel from "@/components/ChatPanel";
import VoicePanel from "@/components/VoicePanel";
import { motion, AnimatePresence } from "framer-motion";

const ChatIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

export default function GlobalAIOverlay() {
  const {
    orbState,
    lastResponse,
    transcript,
    messages,
    setOrbState,
    setLastResponse,
    setTranscript,
    addMessage,
    setMessages,
    setHousehold,
    setEmergency,
    addNotification,
  } = useTwinStore();

  const [chatOpen, setChatOpen] = useState(false);
  const speakTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const init = async () => {
      const [data, history, briefing] = await Promise.all([
        getHousehold(),
        getChatHistory() as Promise<any[]>,
        getBriefing(),
      ]);

      if (data) setHousehold(data);

      const all = [];
      if (briefing) {
        all.push({
          id: `briefing-${Date.now()}`,
          role: "assistant",
          text: briefing.spoken,
          envelope: briefing,
          timestamp: Date.now() - 1_000_000,
        });
      }

      if (history && history.length > 0) {
        all.push(
          ...history.map((msg) => ({
            id: `db-${msg.id}`,
            role: msg.role,
            text: msg.text,
            envelope: msg.envelope,
            timestamp: new Date(msg.created_at).getTime(),
          }))
        );
      }
      if (all.length > 0) setMessages(all);
    };
    init();
  }, [setHousehold, setMessages]);

  const handleCommand = useCallback(
    async (inputTranscript: string, lang: "en" | "bn" = "en") => {
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
      addMessage({ id: `u-${Date.now()}`, role: "user", text: inputTranscript, timestamp: Date.now() });

      const data = await post("/api/voice/command", { transcript: inputTranscript, language: lang });

      if (data) {
        const envelope = data as ResponseEnvelope;
        if (envelope.verdict === "EMERGENCY") setEmergency(true, envelope);
        setLastResponse(envelope);
        setOrbState("speaking");
        addMessage({ id: `a-${Date.now()}`, role: "assistant", text: envelope.spoken, envelope, timestamp: Date.now() });

        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        const utterance = speak(envelope.spoken, (envelope.language as "en" | "bn") ?? lang);
        if (utterance) {
          utterance.onend = () => {
            if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current);
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            if (envelope.verdict === "CLARIFY" && isSTTSupported) {
              setOrbState("listening");
              // eslint-disable-next-line @typescript-eslint/no-use-before-define
              startListening(lang);
            } else setOrbState("idle");
          };
          speakTimeoutRef.current = setTimeout(() => {
            setOrbState("idle");
          }, 8000);
        } else {
          setTimeout(() => setOrbState("idle"), Math.max(2500, envelope.spoken.split(" ").length * 350));
        }
      } else {
        setOrbState("error");
        setTimeout(() => setOrbState("idle"), 2000);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setOrbState, setLastResponse, setTranscript, addMessage, setEmergency]
  );

  const { isListening, isSTTSupported, startListening, stopListening, speak, cancelSpeech } =
    useVoice({
      onTranscript: handleCommand,
      onError: () => { setOrbState("error"); setTimeout(() => setOrbState("idle"), 2000); },
      onListeningEnd: () => { if (useTwinStore.getState().orbState === "listening") setOrbState("idle"); },
    });

  function handleOrbClick() {
    cancelSpeech();
    if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current);
    if (orbState === "listening") {
      stopListening();
      setOrbState("idle");
    } else {
      setOrbState("listening");
      startListening("en");
    }
  }

  async function handleAction(action: any) {
    if (action.type === "notify_caregiver" && action.target) {
      const result = await postCareNotify(action.target, "Safety alert from HealthTwin");
      if (result?.notification) addNotification(result.notification);
    }
    if (action.pending_id) {
      const result = await postVoiceConfirm(action.pending_id, true);
      if (result) {
        const envelope = result as ResponseEnvelope;
        setLastResponse(envelope);
        addMessage({ id: `a-${Date.now()}`, role: "assistant", text: envelope.spoken, envelope, timestamp: Date.now() });
        if (envelope.household_refresh) {
          const fresh = await getHousehold();
          if (fresh) setHousehold(fresh);
        }
        speak(envelope.spoken, "en");
      }
    }
  }

  return (
    <>
      {/* Floating Orb (Bottom Right) */}
      <div className="fixed bottom-8 right-8 z-50 flex items-center gap-4">
        {transcript && orbState !== 'idle' && (
           <div className="bg-white/90 backdrop-blur-md px-4 py-2.5 rounded-2xl text-sm max-w-xs shadow-lg border border-slate-200">
             <p className="text-slate-700 italic font-medium">&ldquo;{transcript}&rdquo;</p>
           </div>
        )}
        <button 
           onClick={() => setChatOpen(!chatOpen)}
           className="w-12 h-12 rounded-full bg-white text-slate-700 flex items-center justify-center hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-lg border border-slate-200"
        >
          <ChatIcon />
        </button>
        <div className="w-16 h-16 relative flex items-center justify-center">
          <VoiceOrb size="md" onClick={handleOrbClick} />
        </div>
      </div>

      {/* Global Chat Side Panel */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 w-[420px] h-full z-40 bg-white shadow-2xl border-l border-slate-200 flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="font-semibold text-slate-800">AI Assistant</h2>
              <button onClick={() => setChatOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                   <line x1="18" y1="6" x2="6" y2="18"></line>
                   <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-hidden bg-white">
              <ChatPanel
                messages={messages}
                isThinking={orbState === "thinking"}
                onExampleClick={(t) => handleCommand(t, "en")}
                onAction={handleAction}
              />
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
               <VoicePanel
                  onSubmit={handleCommand}
                  isListening={isListening}
                  isSTTSupported={isSTTSupported}
                  onMicClick={(lang) => {
                     cancelSpeech();
                     if (orbState === "listening") { stopListening(); setOrbState("idle"); }
                     else { setOrbState("listening"); startListening(lang); }
                  }}
                  disabled={orbState === "thinking" || orbState === "speaking"}
               />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
