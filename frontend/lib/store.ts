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
  voiceEnabled: boolean;
  currentSessionId: number | null;
  // Samantha context
  selectedFamilyMembers: string[];      // role_labels of members selected for context
  samanthaMode: "voice-only" | "voice-text" | "text-only";
  conversationMode: "general" | "family" | "health" | "emergency" | "daily";
  theme: "light" | "dark";
  samanthaGreeted: boolean;

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
  toggleVoice: () => void;
  setCurrentSessionId: (id: number | null) => void;
  toggleFamilyMember: (roleLabel: string) => void;
  clearFamilySelection: () => void;
  setSamanthaMode: (mode: TwinState["samanthaMode"]) => void;
  setConversationMode: (mode: TwinState["conversationMode"]) => void;
  setTheme: (theme: TwinState["theme"]) => void;
  setSamanthaGreeted: (greeted: boolean) => void;
}

const readVoicePref = () => {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem("ht-voice");
  if (stored === null) return false;   // first visit → voice off by default
  return stored === "on";
};

const readThemePref = (): "light" | "dark" => {
  if (typeof window === "undefined") return "light";
  return (localStorage.getItem("ht-theme") as "light" | "dark") ?? "light";
};

const readSamanthaMode = (): TwinState["samanthaMode"] => {
  if (typeof window === "undefined") return "voice-text";
  return (localStorage.getItem("ht-mode") as TwinState["samanthaMode"]) ?? "voice-text";
};

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
  voiceEnabled: readVoicePref(),
  currentSessionId: null,
  selectedFamilyMembers: [],
  samanthaMode: readSamanthaMode(),
  conversationMode: "general",
  theme: readThemePref(),
  samanthaGreeted: false,

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
  toggleVoice: () =>
    set((s) => {
      const next = !s.voiceEnabled;
      if (typeof window !== "undefined") localStorage.setItem("ht-voice", next ? "on" : "off");
      return { voiceEnabled: next };
    }),
  setCurrentSessionId: (id) => set({ currentSessionId: id }),
  toggleFamilyMember: (roleLabel) =>
    set((s) => ({
      selectedFamilyMembers: s.selectedFamilyMembers.includes(roleLabel)
        ? s.selectedFamilyMembers.filter((r) => r !== roleLabel)
        : [...s.selectedFamilyMembers, roleLabel],
    })),
  clearFamilySelection: () => set({ selectedFamilyMembers: [] }),
  setSamanthaMode: (samanthaMode) => {
    if (typeof window !== "undefined") localStorage.setItem("ht-mode", samanthaMode);
    set({ samanthaMode });
  },
  setConversationMode: (conversationMode) => set({ conversationMode }),
  setTheme: (theme) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("ht-theme", theme);
      document.documentElement.setAttribute("data-theme", theme === "dark" ? "dark" : "");
    }
    set({ theme });
  },
  setSamanthaGreeted: (samanthaGreeted) => set({ samanthaGreeted }),
}));
