"use client";

import PageHeader from "@/components/shell/PageHeader";
import { useTwinStore } from "@/lib/store";
import { useHealthTwinCommand } from "@/hooks/useHealthTwinCommand";
import ChatPanel from "@/components/ChatPanel";
import VoicePanel from "@/components/VoicePanel";
import VerdictCard from "@/components/VerdictCard";
import { postCareNotify, postVoiceConfirm, getHousehold } from "@/lib/api";

export default function AskPage() {
  const { messages, orbState, lastResponse, voiceEnabled, setOrbState, addNotification, setLastResponse, addMessage, setHousehold } = useTwinStore();
  const { handleCommand, handleMicClick, isListening, isSTTSupported, speak } = useHealthTwinCommand();
  const isProcessing = orbState === "thinking" || orbState === "speaking";

  async function handleAction(action: { type: string; label: string; target: string | null; pending_id?: string }) {
    if (action.type === "notify_caregiver" && action.target) {
      const result = await postCareNotify(action.target, "Safety alert from HealthTwin");
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
        const envelope = result;
        setLastResponse(envelope);
        addMessage({
          id: `a-${Date.now()}`,
          role: "assistant",
          text: envelope.spoken,
          envelope,
          timestamp: Date.now(),
        });
        
        if (envelope.household_refresh) {
          const fresh = await getHousehold();
          if (fresh) setHousehold(fresh);
        }
        
        if (envelope.spoken && voiceEnabled) {
          const utterance = speak(envelope.spoken, (envelope.language as "en" | "bn") ?? "en");
          if (utterance) utterance.onend = () => setOrbState("idle");
          else setTimeout(() => setOrbState("idle"), 2500);
        } else {
          setTimeout(() => setOrbState("idle"), 1500);
        }
      }
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Ask HealthTwin"
        subtitle="Voice, text, and safety-backed answers"
        onCommand={(cmd) => handleCommand(cmd, "en", false)}
      />

      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
        {/* Main Column: Chat */}
        <div className="flex-1 flex flex-col min-w-0 border-r" style={{ borderColor: "var(--border)" }}>
          <div className="flex-1 overflow-y-auto">
            <ChatPanel
              messages={messages}
              isThinking={orbState === "thinking"}
              onExampleClick={(t) => handleCommand(t, "en", false)}
              onAction={handleAction}
            />
          </div>
          
          {/* Sticky Input Composer */}
          <div className="shrink-0 p-5 border-t" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
             <VoicePanel
               onSubmit={(t, l) => handleCommand(t, l, false)}
               isListening={isListening}
               isSTTSupported={isSTTSupported}
               onMicClick={handleMicClick}
               onAttachClick={() => {}}
               onScanClick={() => {}}
               disabled={isProcessing}
             />
          </div>
        </div>

        {/* Right Column: Result & Safety Trace */}
        <div className="hidden lg:flex flex-col w-[420px] shrink-0 overflow-y-auto" style={{ background: "var(--canvas)" }}>
          <div className="p-6">
            <h3 className="text-sm font-bold uppercase tracking-wide mb-4" style={{ color: "var(--ink-soft)" }}>Current Result</h3>
            <VerdictCard response={lastResponse} onAction={handleAction} />
          </div>
        </div>
      </div>
    </div>
  );
}
