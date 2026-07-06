import { useCallback, useRef } from "react";
import { useTwinStore } from "@/lib/store";
import { useVoice } from "@/hooks/useVoice";
import { post } from "@/lib/api";
import { ResponseEnvelope } from "@/lib/types";
import { useRouter } from "next/navigation";

export function useHealthTwinCommand() {
  const {
    setOrbState,
    setLastResponse,
    setTranscript,
    addMessage,
    setEmergency,
    orbState,
  } = useTwinStore();
  
  const router = useRouter();

  const speakTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { isListening, isSTTSupported, startListening, stopListening, speak, cancelSpeech } =
    useVoice({
      onTranscript: (t, l) => handleCommand(t, l),
      onError: () => {
        setOrbState("error");
        setTimeout(() => setOrbState("idle"), 2000);
      },
      onListeningEnd: () => {
        if (useTwinStore.getState().orbState === "listening") setOrbState("idle");
      },
    });

  const handleCommand = useCallback(
    async (inputTranscript: string, lang: "en" | "bn", redirect: boolean = true) => {
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

      if (redirect) {
        router.push("/ask");
      }

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

        const utterance = speak(envelope.spoken, (envelope.language as "en" | "bn") ?? lang);
        if (utterance) {
          speakTimeoutRef.current = setTimeout(() => {
            if (envelope.verdict === "CLARIFY" && isSTTSupported) {
              setOrbState("listening");
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
            if (envelope.verdict === "CLARIFY" && isSTTSupported) {
              setOrbState("listening");
              startListening(lang);
            } else {
              setOrbState("idle");
            }
          };
        } else {
          const wordCount = envelope.spoken.split(" ").length;
          setTimeout(() => {
            if (envelope.verdict === "CLARIFY" && isSTTSupported) {
              setOrbState("listening");
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
    [setOrbState, setLastResponse, setTranscript, addMessage, router, speak, isSTTSupported, startListening, setEmergency]
  );

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

  return {
    handleCommand,
    handleOrbClick,
    handleMicClick,
    isListening,
    isSTTSupported,
    speak,
    cancelSpeech,
  };
}
