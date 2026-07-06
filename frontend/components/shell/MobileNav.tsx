"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MessageCircle, Users, FileText, AlertTriangle } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/ask", label: "Ask", icon: MessageCircle },
  { href: "/family", label: "Family", icon: Users },
  { href: "/records", label: "Records", icon: FileText },
  { href: "/emergency", label: "Emergency", icon: AlertTriangle },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden shrink-0 flex items-center justify-between px-2 py-2" style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}>
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex-1 flex flex-col items-center gap-1 p-2 rounded-xl transition-colors"
            style={{
              color: active ? "var(--primary)" : "var(--ink-faint)",
            }}
          >
            <item.icon size={20} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
