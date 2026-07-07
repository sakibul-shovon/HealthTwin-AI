"use client";

import { usePathname } from "next/navigation";
import AppShell from "@/components/shell/AppShell";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/") return <>{children}</>;
  return <AppShell>{children}</AppShell>;
}
