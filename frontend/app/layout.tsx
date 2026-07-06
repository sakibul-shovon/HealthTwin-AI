import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/shell/AppShell";

export const metadata: Metadata = {
  title: "Samantha — AI Family Assistant",
  description: "Your personal AI companion for family health and wellbeing",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
