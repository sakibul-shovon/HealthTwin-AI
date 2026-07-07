"use client";

import { useEffect, useState } from "react";
import SidebarNav from "./SidebarNav";
import MobileNav from "./MobileNav";
import SamanthaBar from "@/components/SamanthaBar";
import { useTwinStore } from "@/lib/store";
import { VoiceCommandProvider } from "@/lib/VoiceCommandContext";
import EmergencyMode from "@/components/EmergencyMode";
import VoiceOverlay from "@/components/VoiceOverlay";
import { postCareNotify, getHousehold, getChatHistory } from "@/lib/api";

function ShellInner({ children }: { children: React.ReactNode }) {
  const {
    notifications,
    dismissNotification,
    addNotification,
    setOrbState,
    setHousehold,
    setMessages,
    setLastResponse,
    setTheme,
  } = useTwinStore();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Apply saved theme to DOM
    const saved = localStorage.getItem("ht-theme") as "light" | "dark" | null;
    if (saved === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
      setTheme("dark");
    }

    const init = async () => {
      const [hh, history] = await Promise.all([getHousehold(), getChatHistory(10)]);
      if (hh) setHousehold(hh);
      if (history && history.length > 0) {
        setMessages(history);
        const last = history[history.length - 1];
        if (last.role === "assistant" && last.envelope) {
          setLastResponse(last.envelope);
        }
      }
    };
    init();
  }, []);

  async function handleAction(action: {
    type: string;
    label: string;
    target: string | null;
    pending_id?: string;
  }) {
    if (action.type === "notify_caregiver" && action.target) {
      const result = await postCareNotify(action.target, "Safety alert from Samantha");
      if (result?.notification) {
        addNotification(result.notification);
        setOrbState("speaking");
        setTimeout(() => setOrbState("idle"), 2500);
      } else {
        setOrbState("error");
        setTimeout(() => setOrbState("idle"), 2000);
      }
    }
  }

  if (!mounted) return null;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--canvas)" }}>
      {/* Desktop sidebar */}
      <div className="hidden lg:block shrink-0 h-full z-10">
        <SidebarNav />
      </div>

      {/* Main content column */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <main className="flex-1 overflow-y-auto relative custom-scrollbar flex flex-col min-h-0">
          {children}
        </main>

        {/* Samantha voice bar — always visible above mobile nav */}
        <SamanthaBar />

        <MobileNav />
      </div>

      <EmergencyMode onAction={handleAction} />
      <VoiceOverlay />

      {/* Toast notifications */}
      {notifications.length > 0 && (
        <div className="fixed bottom-24 lg:bottom-20 right-4 z-50 flex flex-col gap-2 max-w-xs">
          {notifications.map((n) => (
            <div
              key={n.id}
              className="flex items-start gap-2 rounded-2xl px-4 py-3 shadow-2xl glass-bright"
              style={{ border: "1px solid var(--primary)33" }}
            >
              <span className="text-xs mt-0.5">🔔</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold" style={{ color: "var(--ink)" }}>
                  → {n.target}
                </p>
                <p className="text-[11px] truncate" style={{ color: "var(--ink-soft)" }}>
                  {n.message}
                </p>
              </div>
              <button
                onClick={() => dismissNotification(n.id)}
                className="text-[11px] shrink-0 hover:opacity-70"
                style={{ color: "var(--ink-soft)" }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <VoiceCommandProvider>
      <ShellInner>{children}</ShellInner>
    </VoiceCommandProvider>
  );
}
