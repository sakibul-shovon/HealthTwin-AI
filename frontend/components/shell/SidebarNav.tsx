"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MessageCircle, Users, FileText, FileBarChart, AlertTriangle, Activity } from "lucide-react";
import { useTwinStore } from "@/lib/store";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/ask", label: "Ask HealthTwin", icon: MessageCircle },
  { href: "/family", label: "Family", icon: Users },
  { href: "/records", label: "Records", icon: FileText },
  { href: "/reports", label: "Reports", icon: FileBarChart },
  { href: "/emergency", label: "Emergency", icon: AlertTriangle },
  { href: "/activity", label: "Activity", icon: Activity },
];

export default function SidebarNav() {
  const pathname = usePathname();
  const { household } = useTwinStore();

  return (
    <aside className="w-60 h-full flex flex-col shrink-0" style={{ background: "var(--surface)", borderRight: "1px solid var(--border)" }}>
      <div className="px-5 py-6 shrink-0 flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs"
          style={{
            background: "linear-gradient(135deg, var(--primary), var(--accent))",
            color: "#fff",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          HT
        </div>
        <div>
          <h1 className="text-sm font-bold leading-tight" style={{ color: "var(--ink)" }}>HealthTwin</h1>
          {household && <p className="text-[10px] font-medium" style={{ color: "var(--ink-soft)" }}>{household.name}</p>}
        </div>
      </div>

      <nav className="flex-1 px-3 py-2 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: active ? "var(--primary-tint)" : "transparent",
                color: active ? "var(--primary)" : "var(--ink-soft)",
              }}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 shrink-0 flex flex-col gap-2">
         {/* System Status / Theme toggle could go here */}
         <div className="px-3 py-2 rounded-lg text-xs font-medium text-center transition-colors" style={{ background: "var(--surface-sunk)", color: "var(--ink-soft)" }}>
           System Online
         </div>
      </div>
    </aside>
  );
}
