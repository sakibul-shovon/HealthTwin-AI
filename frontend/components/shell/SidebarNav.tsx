"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, MessageCircle, Users, FileText, ShieldAlert, Sun, Moon, LogOut, Cpu, Sparkles } from "lucide-react";
import { useTwinStore } from "@/lib/store";
import { AnimatePresence, motion } from "framer-motion";

const NAV_ITEMS = [
  { href: "/get-started", label: "Get Started", icon: Sparkles, highlight: true },
  { href: "/home",        label: "Home",          icon: Home },
  { href: "/ask",         label: "Conversations", icon: MessageCircle },
  { href: "/family",      label: "Family",        icon: Users },
  { href: "/records",     label: "Records",       icon: FileText },
  { href: "/emergency",   label: "Emergency",     icon: ShieldAlert },
  { href: "/system",      label: "AI System",     icon: Cpu },
];

const ORB_LABEL: Record<string, string> = {
  idle: "Ready", listening: "Listening", thinking: "Thinking", speaking: "Speaking", error: "Error",
};

const ORB_COLOR: Record<string, string> = {
  idle: "var(--primary)", listening: "var(--accent)", thinking: "var(--primary-deep)",
  speaking: "var(--well)", error: "var(--urgent)",
};

export default function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { household, orbState, theme, setTheme, authUser, clearAuth } = useTwinStore();

  function handleLogout() {
    clearAuth();
    router.push("/");
  }

  return (
    <aside
      className="w-60 h-full flex flex-col shrink-0"
      style={{ background: "var(--surface)", borderRight: "1px solid var(--border)" }}
    >
      {/* Brand */}
      <div className="px-5 pt-6 pb-4 shrink-0 flex items-center gap-3">
        <div
          className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-sm text-white shrink-0 ${orbState !== "idle" ? "sidebar-logo-pulse" : ""}`}
          style={{ background: "linear-gradient(135deg, var(--primary), var(--accent))", boxShadow: "0 2px 10px rgba(15,76,85,0.25)" }}
        >S</div>
        <div>
          <h1 className="text-sm font-bold leading-tight" style={{ color: "var(--ink)" }}>Samantha</h1>
          <p className="text-[10px] font-medium" style={{ color: "var(--ink-soft)" }}>
            {household?.name ?? authUser?.family_name ?? "AI Assistant"}
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-1 flex flex-col gap-0.5 overflow-y-auto custom-scrollbar">
        {NAV_ITEMS.map((item, idx) => {
          const isEmergency = item.href === "/emergency";
          const isHighlight = (item as any).highlight;
          const active = pathname === item.href || (item.href !== "/home" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                background: active
                  ? isHighlight ? "var(--accent-tint)" : isEmergency ? "var(--urgent-bg)" : "var(--primary-tint)"
                  : isHighlight ? "var(--accent-tint)" : "transparent",
                color: active
                  ? isHighlight ? "var(--accent-deep)" : isEmergency ? "var(--urgent)" : "var(--primary)"
                  : isHighlight ? "var(--accent)" : isEmergency ? "var(--urgent)" : "var(--ink-soft)",
                marginBottom: idx === 0 ? "4px" : undefined,
              }}
            >
              <item.icon size={17} strokeWidth={active ? 2.2 : 1.8} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 shrink-0 flex flex-col gap-2">
        {/* Samantha status */}
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl" style={{ background: "var(--surface-sunk)" }}>
          <div
            className={`w-2 h-2 rounded-full shrink-0 ${orbState === "listening" ? "sidebar-dot-listen" : orbState === "thinking" ? "sidebar-dot-think" : ""}`}
            style={{ background: ORB_COLOR[orbState] }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold leading-none" style={{ color: "var(--ink-soft)" }}>SAMANTHA</p>
            <p className="text-[11px] font-semibold mt-0.5 leading-none" style={{ color: "var(--ink)" }}>
              <AnimatePresence mode="wait">
                <motion.span key={orbState} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -3 }} transition={{ duration: 0.2 }} className="block">
                  {ORB_LABEL[orbState]}
                </motion.span>
              </AnimatePresence>
            </p>
          </div>
        </div>

        {/* User email */}
        {authUser && (
          <p className="text-[10px] px-3 truncate" style={{ color: "var(--ink-faint)" }}>{authUser.email}</p>
        )}

        {/* Theme + Logout row */}
        <div className="flex gap-1">
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-medium transition-colors hover:opacity-80"
            style={{ color: "var(--ink-soft)" }}>
            {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-medium transition-colors hover:opacity-80"
            style={{ color: "var(--ink-soft)" }}
            title="Sign out">
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}
