"use client";

import { useEffect, useState } from "react";
import SidebarNav from "./SidebarNav";
import MobileNav from "./MobileNav";
import { useTwinStore } from "@/lib/store";
import EmergencyMode from "@/components/EmergencyMode";
import { postCareNotify, getHousehold, getChatHistory } from "@/lib/api";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { notifications, dismissNotification, addNotification, setOrbState, setHousehold, setMessages, setLastResponse } = useTwinStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const init = async () => {
      const [hh, history] = await Promise.all([
        getHousehold(),
        getChatHistory(10)
      ]);
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
      const result = await postCareNotify(action.target, "Safety alert from HealthTwin");
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
      <div className="hidden lg:block shrink-0 h-full z-10">
        <SidebarNav />
      </div>
      
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <main className="flex-1 overflow-y-auto relative custom-scrollbar flex flex-col min-h-0">
          {children}
        </main>
        <MobileNav />
      </div>

      <EmergencyMode onAction={handleAction} />

      {/* Toast notifications */}
      {notifications.length > 0 && (
        <div className="fixed bottom-20 lg:bottom-6 right-6 z-50 flex flex-col gap-2 max-w-xs">
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
