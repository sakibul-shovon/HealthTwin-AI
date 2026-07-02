import { create } from "zustand";
import { Household, ResponseEnvelope, ChatMessage } from "./types";

export interface AppNotification {
  id: string;
  target: string;
  message: string;
  from_member: string;
  timestamp: string;
}

interface TwinState {
  household: Household | null;
  activeMember: string | null;
  orbState: "idle" | "listening" | "thinking" | "speaking" | "error";
  lastResponse: ResponseEnvelope | null;
  transcript: string;
  notifications: AppNotification[];
  messages: ChatMessage[];
  emergencyActive: boolean;
  emergencyData: ResponseEnvelope | null;
  setHousehold: (household: Household) => void;
  setActiveMember: (member: string | null) => void;
  setOrbState: (state: TwinState["orbState"]) => void;
  setLastResponse: (response: ResponseEnvelope | null) => void;
  setTranscript: (transcript: string) => void;
  addNotification: (n: AppNotification) => void;
  dismissNotification: (id: string) => void;
  addMessage: (msg: ChatMessage) => void;
  setMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;
  setEmergency: (active: boolean, data?: ResponseEnvelope | null) => void;
}

export const useTwinStore = create<TwinState>((set) => ({
  household: null,
  activeMember: null,
  orbState: "idle",
  lastResponse: null,
  transcript: "",
  notifications: [],
  messages: [],
  emergencyActive: false,
  emergencyData: null,
  setHousehold: (household) => set({ household }),
  setActiveMember: (activeMember) => set({ activeMember }),
  setOrbState: (orbState) => set({ orbState }),
  setLastResponse: (lastResponse) => set({ lastResponse }),
  setTranscript: (transcript) => set({ transcript }),
  addNotification: (n) => set((s) => ({ notifications: [n, ...s.notifications].slice(0, 5) })),
  dismissNotification: (id) =>
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setMessages: (messages) => set({ messages }),
  clearMessages: () => set({ messages: [] }),
  setEmergency: (active, data = null) => set({ emergencyActive: active, emergencyData: data }),
}));
