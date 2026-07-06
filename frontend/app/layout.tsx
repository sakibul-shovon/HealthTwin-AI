import type { Metadata } from "next";
import "./globals.css";
import GlobalSidebar from "@/components/GlobalSidebar";
import GlobalAIOverlay from "@/components/GlobalAIOverlay";

export const metadata: Metadata = {
  title: "HealthTwin — Family Command Center",
  description: "Voice-controlled health intelligence for the whole family",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased flex h-screen overflow-hidden text-white bg-[var(--canvas)]">
        <GlobalSidebar />
        <main className="flex-1 flex flex-col min-w-0 h-full relative">
          {children}
        </main>
        <GlobalAIOverlay />
      </body>
    </html>
  );
}
