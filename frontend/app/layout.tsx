import type { Metadata } from "next";
import "./globals.css";

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
      <body className="antialiased">{children}</body>
    </html>
  );
}
