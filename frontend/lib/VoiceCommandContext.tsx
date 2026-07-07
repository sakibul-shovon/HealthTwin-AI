"use client";

import { createContext, useContext, ReactNode } from "react";
import { useHealthTwinCommand } from "@/hooks/useHealthTwinCommand";

type CommandHook = ReturnType<typeof useHealthTwinCommand>;

const VoiceCommandContext = createContext<CommandHook | null>(null);

export function VoiceCommandProvider({ children }: { children: ReactNode }) {
  const hook = useHealthTwinCommand();
  return (
    <VoiceCommandContext.Provider value={hook}>
      {children}
    </VoiceCommandContext.Provider>
  );
}

export function useVoiceCommand(): CommandHook {
  const ctx = useContext(VoiceCommandContext);
  if (!ctx) throw new Error("useVoiceCommand must be used within VoiceCommandProvider");
  return ctx;
}
