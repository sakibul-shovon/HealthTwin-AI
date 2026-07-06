"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTwinStore } from "@/lib/store";
import { useVoiceCommand } from "@/lib/VoiceCommandContext";
import { getBriefing, getInsights } from "@/lib/api";
import { InsightItem, RiskBand } from "@/lib/types";
import Constellation from "@/components/Constellation";
import Link from "next/link";
import { ShieldAlert, ChevronRight, Play } from "lucide-react";

function useClockTick() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function formatTime(d: Date) {
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function greeting(d: Date): string {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const SEVERITY_COLOR: Record<string, string> = {
  HIGH: "var(--urgent)",
  MED:  "var(--watch)",
  LOW:  "var(--info)",
};

export default function HomePage() {
  const {
    household,
    activeMember,
    selectedFamilyMembers,
    toggleFamilyMember,
    clearFamilySelection,
    voiceEnabled,
    setSamanthaGreeted,
  } = useTwinStore();

  const { speak, cancelSpeech } = useVoiceCommand();

  const now = useClockTick();
  const [briefing, setBriefing] = useState<any>(null);
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [riskBands, setRiskBands] = useState<Record<string, RiskBand>>({});
  const [isPlaying, setIsPlaying] = useState(false);

  const members = household?.members ?? [];

  // Self member for personalised greeting
  const selfMember = members.find(
    (m) => m.role_label === "Self" || m.role_label?.toLowerCase() === "self"
  );
  const firstName =
    selfMember?.display_name?.split(" ")[0] ??
    household?.name?.split(" ")[0] ??
    "there";

  useEffect(() => {
    const init = async () => {
      const [brief, insightData] = await Promise.all([
        getBriefing(),
        getInsights(),
      ]);
      if (brief) setBriefing(brief);
      if (insightData) {
        setInsights(insightData.insights ?? []);
        setRiskBands(insightData.risk_bands ?? {});
      }
    };
    init();
  }, []);

  function playGreeting() {
    if (!briefing || !voiceEnabled) return;
    setIsPlaying(true);
    const fullGreeting = `${greeting(now)}, ${firstName}. ${briefing.spoken}`;
    const handle = speak(fullGreeting, "en");
    setSamanthaGreeted(true);
    if (handle) {
      handle.onend = () => setIsPlaying(false);
    } else {
      setTimeout(() => setIsPlaying(false), 4000);
    }
  }

  function stopGreeting() {
    cancelSpeech();
    setIsPlaying(false);
  }

  const highInsights = insights.filter((i) => i.severity === "HIGH").slice(0, 3);
  const otherInsights = insights.filter((i) => i.severity !== "HIGH").slice(0, 3);
  const displayInsights = [...highInsights, ...otherInsights].slice(0, 4);

  return (
    <div
      className="flex flex-col min-h-full overflow-y-auto custom-scrollbar pb-4"
      style={{ background: "var(--canvas)" }}
    >
      {/* ── Time & greeting row ─────────────────────────────────────────── */}
      <div className="px-6 pt-8 pb-6 flex items-start justify-between gap-4">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="font-mono-num font-bold leading-none"
            style={{ fontSize: "clamp(2.4rem, 6vw, 3.5rem)", color: "var(--ink)" }}
          >
            {formatTime(now)}
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-base font-medium mt-1"
            style={{ color: "var(--ink-soft)" }}
          >
            {formatDate(now)}
          </motion.p>
        </div>

        {/* Emergency shortcut */}
        <Link
          href="/emergency"
          className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-opacity hover:opacity-80"
          style={{ background: "var(--urgent-bg)", color: "var(--urgent)" }}
        >
          <ShieldAlert size={14} />
          SOS
        </Link>
      </div>

      {/* ── Samantha greeting card ──────────────────────────────────────── */}
      <div className="px-6 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.15 }}
          className="glass-card p-5 relative overflow-hidden"
        >
          {/* Subtle gradient accent */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at top left, rgba(15,76,85,0.06) 0%, transparent 60%)",
            }}
          />

          <div className="flex gap-4 relative z-10">
            {/* Samantha avatar */}
            <motion.div
              className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-white text-sm shrink-0"
              style={{
                background: "linear-gradient(135deg, var(--primary), var(--accent))",
                boxShadow: "0 2px 12px rgba(15,76,85,0.20)",
              }}
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              S
            </motion.div>

            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--ink-soft)" }}>
                Samantha
              </p>
              <AnimatePresence mode="wait">
                {briefing ? (
                  <motion.p
                    key="briefing"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-sm leading-relaxed"
                    style={{ color: "var(--ink)" }}
                  >
                    <span style={{ color: "var(--ink-soft)" }}>{greeting(now)}, {firstName}. </span>
                    {briefing.spoken}
                  </motion.p>
                ) : (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex gap-1 items-center"
                  >
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: "var(--ink-faint)" }}
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {briefing && (
                <div className="flex items-center gap-3 mt-3">
                  {/* Manual play/stop button */}
                  <button
                    onClick={isPlaying ? stopGreeting : playGreeting}
                    disabled={!voiceEnabled}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-40"
                    style={{
                      background: isPlaying ? "var(--urgent-bg)" : "var(--primary-tint)",
                      color: isPlaying ? "var(--urgent)" : "var(--primary)",
                    }}
                    title={voiceEnabled ? (isPlaying ? "Stop speaking" : "Play greeting") : "Enable voice to hear greeting"}
                  >
                    {isPlaying ? (
                      <>
                        <motion.span
                          animate={{ opacity: [1, 0.4, 1] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        >■</motion.span>
                        Stop
                      </>
                    ) : (
                      <>
                        <Play size={10} />
                        {voiceEnabled ? "Hear greeting" : "Voice off"}
                      </>
                    )}
                  </button>

                  <Link
                    href="/ask"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold transition-opacity hover:opacity-70"
                    style={{ color: "var(--ink-soft)" }}
                  >
                    Continue <ChevronRight size={12} />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Family constellation ────────────────────────────────────────── */}
      {members.length > 0 && (
        <div className="px-6 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--ink-soft)" }}>
              Family
            </h2>
            <span className="text-[10px]" style={{ color: "var(--ink-faint)" }}>
              Tap to focus Samantha
            </span>
          </div>

          <div className="glass-card py-6 flex flex-col items-center relative overflow-hidden">
            {/* dot grid background */}
            <div className="absolute inset-0 dot-grid opacity-40 pointer-events-none" />

            <Constellation
              members={members}
              focusedMember={activeMember}
              activeMember={null}
              selectedMembers={selectedFamilyMembers}
              riskBands={riskBands}
              verdict={null}
              hero={true}
              onSelect={(roleLabel) => toggleFamilyMember(roleLabel)}
            />

            {/* Context tray */}
            <AnimatePresence>
              {selectedFamilyMembers.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className="mt-4 flex items-center gap-2 flex-wrap justify-center px-4"
                >
                  <span className="text-[10px] font-semibold" style={{ color: "var(--primary)" }}>
                    Samantha is focused on:
                  </span>
                  {selectedFamilyMembers.map((rl) => {
                    const m = members.find((x) => x.role_label === rl);
                    return (
                      <span
                        key={rl}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                        style={{ background: "var(--primary-tint)", color: "var(--primary)" }}
                      >
                        {m?.display_name || rl}
                      </span>
                    );
                  })}
                  <button
                    onClick={clearFamilySelection}
                    className="text-[10px] font-semibold transition-opacity hover:opacity-60"
                    style={{ color: "var(--ink-faint)" }}
                  >
                    Clear
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ── Insights & Actions row ──────────────────────────────────────── */}
      <div className="px-6 grid grid-cols-1 lg:grid-cols-2 gap-4 mb-2">
        {/* AI Insights */}
        {displayInsights.length > 0 && (
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--ink-soft)" }}>
              Needs Attention
            </h2>
            <div className="flex flex-col gap-2">
              {displayInsights.map((insight, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.07 }}
                  className="glass-card px-4 py-3 flex items-start gap-3"
                >
                  <span
                    className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${insight.severity === "HIGH" ? "animate-pulse" : ""}`}
                    style={{ background: SEVERITY_COLOR[insight.severity] ?? "var(--info)" }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold leading-snug" style={{ color: "var(--ink)" }}>
                      {insight.title}
                    </p>
                    <p className="text-[11px] mt-0.5 line-clamp-2" style={{ color: "var(--ink-soft)" }}>
                      {insight.detail}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--ink-soft)" }}>
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: "/ask",       icon: "💬", label: "Conversations",   desc: "Ask Samantha" },
              { href: "/records",   icon: "📄", label: "Scan Document",   desc: "Upload record" },
              { href: "/reports",   icon: "📊", label: "Reports",         desc: "Generate report" },
              { href: "/family",    icon: "👨‍👩‍👧", label: "Family",         desc: "Manage members" },
            ].map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="glass-card p-4 flex flex-col gap-1 hover:opacity-80 transition-opacity group"
              >
                <span className="text-xl">{a.icon}</span>
                <p className="text-xs font-bold leading-snug" style={{ color: "var(--ink)" }}>
                  {a.label}
                </p>
                <p className="text-[10px]" style={{ color: "var(--ink-faint)" }}>
                  {a.desc}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
