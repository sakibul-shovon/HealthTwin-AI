"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageCircle, Users, FileText, ShieldAlert } from "lucide-react";

const NAV_ITEMS = [
  { href: "/",          label: "Home",    icon: Home },
  { href: "/ask",       label: "Chat",    icon: MessageCircle },
  { href: "/family",    label: "Family",  icon: Users },
  { href: "/records",   label: "Records", icon: FileText },
  { href: "/emergency", label: "SOS",     icon: ShieldAlert },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="lg:hidden shrink-0 flex items-center justify-between px-1 py-1"
      style={{
        background: "var(--surface)",
        borderTop: "1px solid var(--border)",
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isEmergency = item.href === "/emergency";
        const active =
          pathname === item.href ||
          (item.href !== "/" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl transition-colors"
            style={{
              color: active
                ? isEmergency
                  ? "var(--urgent)"
                  : "var(--primary)"
                : isEmergency
                ? "var(--urgent)"
                : "var(--ink-faint)",
            }}
          >
            <item.icon size={20} strokeWidth={active ? 2.2 : 1.7} />
            <span className="text-[9px] font-semibold">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
