"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageCircle, Users, FileText, ShieldAlert, Settings, Sun, Moon } from "lucide-react";
import { useTwinStore } from "@/lib/store";
import { AnimatePresence, motion } from "framer-motion";

const NAV_ITEMS = [
  { href: "/",          label: "Home",          icon: Home },
  { href: "/ask",       label: "Conversations", icon: MessageCircle },
  { href: "/family",    label: "Family",        icon: Users },
  { href: "/records",   label: "Records",       icon: FileText },
  { href: "/emergency", label: "Emergency",     icon: ShieldAlert },
  { href: "/settings",  label: "Settings",      icon: Settings },
];

const ORB_LABEL: Record<string, string> = {
  idle:      "Ready",
  listening: "Listening",
  thinking:  "Thinking",
  speaking:  "Speaking",
  error:     "Error",
};

const ORB_COLOR: Record<string, string> = {
  idle:      "var(--primary)",
  listening: "var(--accent)",
  thinking:  "var(--primary-deep)",
  speaking:  "var(--well)",
  error:     "var(--urgent)",
};

export default function SidebarNav() {
  const pathname = usePathname();
  const { household, orbState, theme, setTheme } = useTwinStore();

  return (
    <aside
      className="w-60 h-full flex flex-col shrink-0"
      style={{ background: "var(--surface)", borderRight: "1px solid var(--border)" }}
    >
      {/* Brand */}
      <div className="px-5 pt-6 pb-4 shrink-0 flex items-center gap-3">
        <div
          className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-sm text-white shrink-0 ${orbState !== "idle" ? "sidebar-logo-pulse" : ""}`}
          style={{
            background: "linear-gradient(135deg, var(--primary), var(--accent))",
            boxShadow: "0 2px 10px rgba(15,76,85,0.25)",
          }}
        >
          S
        </div>
        <div>
          <h1 className="text-sm font-bold leading-tight" style={{ color: "var(--ink)" }}>
            Samantha
          </h1>
          <p className="text-[10px] font-medium" style={{ color: "var(--ink-soft)" }}>
            {household?.name ?? "AI Assistant"}
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-1 flex flex-col gap-0.5 overflow-y-auto custom-scrollbar">
        {NAV_ITEMS.map((item) => {
          const isEmergency = item.href === "/emergency";
          const active =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                background: active
                  ? isEmergency
                    ? "var(--urgent-bg)"
                    : "var(--primary-tint)"
                  : "transparent",
                color: active
                  ? isEmergency
                    ? "var(--urgent)"
                    : "var(--primary)"
                  : isEmergency
                  ? "var(--urgent)"
                  : "var(--ink-soft)",
              }}
            >
              <item.icon size={17} strokeWidth={active ? 2.2 : 1.8} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer: Samantha state + theme toggle */}
      <div className="p-4 shrink-0 flex flex-col gap-3">
        {/* Samantha status */}
        <div
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
          style={{ background: "var(--surface-sunk)" }}
        >
          <div
            className={`w-2 h-2 rounded-full shrink-0 ${
              orbState === "listening" ? "sidebar-dot-listen" :
              orbState === "thinking"  ? "sidebar-dot-think"  : ""
            }`}
            style={{ background: ORB_COLOR[orbState] }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold leading-none" style={{ color: "var(--ink-soft)" }}>
              SAMANTHA
            </p>
            <p className="text-[11px] font-semibold mt-0.5 leading-none" style={{ color: "var(--ink)" }}>
              <AnimatePresence mode="wait">
                <motion.span
                  key={orbState}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -3 }}
                  transition={{ duration: 0.2 }}
                  className="block"
                >
                  {ORB_LABEL[orbState]}
                </motion.span>
              </AnimatePresence>
            </p>
          </div>
        </div>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[11px] font-medium transition-colors hover:opacity-80"
          style={{ color: "var(--ink-soft)" }}
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
      </div>
    </aside>
  );
}
