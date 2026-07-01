import { create } from "zustand";
import { Household, ResponseEnvelope } from "./types";

interface TwinState {
  household: Household | null;
  activeMember: string | null;
  orbState: "idle" | "listening" | "thinking" | "speaking" | "error";
  lastResponse: ResponseEnvelope | null;
  transcript: string;
  setHousehold: (household: Household) => void;
  setActiveMember: (member: string | null) => void;
  setOrbState: (state: TwinState["orbState"]) => void;
  setLastResponse: (response: ResponseEnvelope | null) => void;
  setTranscript: (transcript: string) => void;
}

export const useTwinStore = create<TwinState>((set) => ({
  household: null,
  activeMember: null,
  orbState: "idle",
  lastResponse: null,
  transcript: "",
  setHousehold: (household) => set({ household }),
  setActiveMember: (activeMember) => set({ activeMember }),
  setOrbState: (orbState) => set({ orbState }),
  setLastResponse: (lastResponse) => set({ lastResponse }),
  setTranscript: (transcript) => set({ transcript }),
}));
