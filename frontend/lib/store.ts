import { create } from "zustand";
import { Household, ResponseEnvelope, ChatMessage } from "./types";

export interface AppNotification {
  id: string;
  target: string;
  message: string;
  from_member: string;
  timestamp: string;
}

export interface AuthUser {
  user_id: number;
  email: string;
  household_id: number;
  family_name: string;
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
  // Auth
  authUser: AuthUser | null;
  authToken: string | null;
  // Samantha context
  selectedFamilyMembers: string[];
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
  setAuth: (user: AuthUser, token: string) => void;
  clearAuth: () => void;
}

const readVoicePref = () => {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem("ht-voice");
  if (stored === null) return false;
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

const readAuthToken = (): string | null => {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("ht-token");
  // Sync cookie so middleware can read it on hard-refresh
  if (token) {
    document.cookie = `ht-token=${token}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
  }
  return token;
};

const readAuthUser = (): AuthUser | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("ht-user");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
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
  authUser: readAuthUser(),
  authToken: readAuthToken(),
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
  setAuth: (user, token) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("ht-token", token);
      localStorage.setItem("ht-user", JSON.stringify(user));
      // Also set a cookie so Next.js middleware can read it for route protection
      document.cookie = `ht-token=${token}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
    }
    set({ authUser: user, authToken: token });
  },
  clearAuth: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("ht-token");
      localStorage.removeItem("ht-user");
      document.cookie = "ht-token=; path=/; max-age=0";
    }
    set({ authUser: null, authToken: null, household: null, messages: [], currentSessionId: null });
  },
}));
