"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTwinStore } from "@/lib/store";
import { useVoiceCommand } from "@/lib/VoiceCommandContext";
import { getBriefing, getInsights } from "@/lib/api";
import { InsightItem, RiskBand } from "@/lib/types";
import Constellation from "@/components/Constellation";
import Link from "next/link";
import {
  ShieldAlert, ChevronRight, Play, Users, Activity,
  AlertTriangle, MessageCircle, FileText, BarChart2,
} from "lucide-react";
import { useRef } from "react";

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

// hero SIZE = 152*2 + 32*4 + 8 + 48 = 488px — scale it down to fit whatever space is available
const HERO_SIZE = 488;

function ScaledConstellation(props: React.ComponentProps<typeof Constellation>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const box = Math.min(width, height) - 24;
      setScale(Math.min(1, box / HERO_SIZE));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center">
      <div style={{ transform: `scale(${scale})`, transformOrigin: "center center" }}>
        <Constellation {...props} hero={true} />
      </div>
    </div>
  );
}

const QUICK_ACTIONS = [
  { href: "/ask",     Icon: MessageCircle, label: "Conversations", desc: "Ask Samantha" },
  { href: "/records", Icon: FileText,      label: "Scan Document", desc: "Upload record" },
  { href: "/reports", Icon: BarChart2,     label: "Reports",       desc: "Generate report" },
  { href: "/family",  Icon: Users,         label: "Family",        desc: "Manage members" },
];

export default function HomePage() {
  const {
    household, activeMember,
    selectedFamilyMembers, toggleFamilyMember, clearFamilySelection,
    voiceEnabled, setSamanthaGreeted,
  } = useTwinStore();

  const { speak, cancelSpeech } = useVoiceCommand();
  const now = useClockTick();

  const [briefing, setBriefing]   = useState<any>(null);
  const [insights, setInsights]   = useState<InsightItem[]>([]);
  const [riskBands, setRiskBands] = useState<Record<string, RiskBand>>({});
  const [isPlaying, setIsPlaying] = useState(false);

  const members   = household?.members ?? [];
  const selfMember = members.find(m => m.role_label === "Self" || m.role_label?.toLowerCase() === "self");
  const firstName  = selfMember?.display_name?.split(" ")[0] ?? household?.name?.split(" ")[0] ?? "there";

  useEffect(() => {
    // Kick off TTS warmup in background so Kokoro is ready before the user clicks "Hear briefing"
    fetch("/api/tts/warmup", { method: "POST" }).catch(() => {});

    (async () => {
      const [brief, insightData] = await Promise.all([getBriefing(), getInsights()]);
      if (brief) setBriefing(brief);
      if (insightData) {
        setInsights(insightData.insights ?? []);
        setRiskBands(insightData.risk_bands ?? {});
      }
    })();
  }, []);

  function playGreeting() {
    if (!briefing || !voiceEnabled) return;
    setIsPlaying(true);
    const handle = speak(`${greeting(now)}, ${firstName}. ${briefing.spoken}`, "en");
    setSamanthaGreeted(true);
    if (handle) handle.onend = () => setIsPlaying(false);
    else setTimeout(() => setIsPlaying(false), 4000);
  }

  function stopGreeting() { cancelSpeech(); setIsPlaying(false); }

  // Parse medication count from briefing text e.g. "7 active medications"
  const medCount = briefing?.spoken
    ? (briefing.spoken.match(/(\d+) active medications?/)?.[1] ?? null)
    : null;

  const highInsights = insights.filter(i => i.severity === "HIGH").slice(0, 3);
  const watchFlags   = highInsights.slice(0, 2);

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: "var(--canvas)" }}>

      {/* ── Top bar: time + SOS ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 pt-5 pb-3 shrink-0">
        <div className="flex items-baseline gap-3">
          <motion.span initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="font-mono-num font-bold"
            style={{ fontSize: "2rem", color: "var(--ink)", letterSpacing: "-0.02em" }}>
            {formatTime(now)}
          </motion.span>
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            className="text-sm font-medium" style={{ color: "var(--ink-soft)" }}>
            {formatDate(now)}
          </motion.span>
        </div>
        <Link href="/emergency"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold hover:opacity-80 transition-opacity"
          style={{ background: "var(--urgent-bg)", color: "var(--urgent)" }}>
          <ShieldAlert size={13} /> SOS
        </Link>
      </div>

      {/* ── Full-width Samantha dashboard card ─────────────────────────────── */}
      <div className="px-6 pb-3 shrink-0">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="glass-card px-5 py-4 relative overflow-hidden"
        >
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at top left, rgba(15,76,85,0.06) 0%, transparent 60%)" }} />

          <div className="flex items-center gap-5 relative z-10">

            {/* S avatar */}
            <motion.div
              className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-white text-sm shrink-0"
              style={{ background: "linear-gradient(135deg, var(--primary), var(--accent))", boxShadow: "0 2px 12px rgba(15,76,85,0.20)" }}
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 4, repeat: Infinity }}>
              S
            </motion.div>

            {/* Greeting */}
            <div className="shrink-0">
              <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Samantha</p>
              <p className="text-sm font-bold leading-tight" style={{ color: "var(--ink)" }}>
                {greeting(now)}, {firstName}
              </p>
              <p className="text-[10px]" style={{ color: "var(--ink-faint)" }}>{household?.name ?? "Your Family"}</p>
            </div>

            {/* Vertical divider */}
            <div className="w-px h-10 shrink-0" style={{ background: "var(--border)" }} />

            {/* Stat chips */}
            <div className="flex items-center gap-2 flex-1 flex-wrap">

              {/* Member count */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                style={{ background: "var(--primary-tint)", color: "var(--primary)" }}>
                <Users size={12} />
                <span className="text-[11px] font-bold">{members.length} Members</span>
              </div>

              {/* Medication count */}
              {medCount && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                  style={{ background: "var(--well-bg)", color: "var(--well)" }}>
                  <Activity size={12} />
                  <span className="text-[11px] font-bold">{medCount} Medications</span>
                </div>
              )}

              {/* Watch flags */}
              {watchFlags.map((f, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                  style={{ background: "var(--watch-bg)", color: "var(--watch)" }}>
                  <AlertTriangle size={11} />
                  <span className="text-[11px] font-bold max-w-[160px] truncate">{f.title}</span>
                </motion.div>
              ))}

              {/* Loading shimmer while briefing loads */}
              {!briefing && (
                <motion.div className="flex gap-1 items-center px-2">
                  {[0, 1, 2].map(i => (
                    <motion.div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--ink-faint)" }}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
                  ))}
                </motion.div>
              )}
            </div>

            {/* Voice + Continue buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {briefing && (
                <button
                  onClick={isPlaying ? stopGreeting : playGreeting}
                  disabled={!voiceEnabled}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all disabled:opacity-40"
                  style={{
                    background: isPlaying ? "var(--urgent-bg)" : "var(--surface-sunk)",
                    color: isPlaying ? "var(--urgent)" : "var(--ink-soft)",
                  }}
                  title={voiceEnabled ? (isPlaying ? "Stop" : "Hear briefing") : "Enable voice in sidebar"}>
                  {isPlaying ? (
                    <><motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1, repeat: Infinity }}>■</motion.span> Stop</>
                  ) : (
                    <><Play size={11} /> {voiceEnabled ? "Hear briefing" : "Voice off"}</>
                  )}
                </button>
              )}
              <Link href="/ask"
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-semibold hover:opacity-70 transition-opacity"
                style={{ background: "var(--primary-tint)", color: "var(--primary)" }}>
                Ask Samantha <ChevronRight size={11} />
              </Link>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Two-column bottom ───────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 grid grid-cols-2 gap-4 px-6 pb-5 overflow-hidden">

        {/* LEFT: Family constellation */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="glass-card flex flex-col relative overflow-hidden"
        >
          <div className="absolute inset-0 dot-grid opacity-40 pointer-events-none" />
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at center, rgba(15,76,85,0.04) 0%, transparent 70%)" }} />

          <div className="px-5 pt-4 pb-1 shrink-0 relative z-10 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--ink-soft)" }}>Family</p>
            <p className="text-[10px]" style={{ color: "var(--ink-faint)" }}>Tap to focus Samantha</p>
          </div>

          <div className="flex-1 min-h-0 relative z-10">
            {members.length > 0 ? (
              <ScaledConstellation
                members={members}
                focusedMember={activeMember}
                activeMember={null}
                selectedMembers={selectedFamilyMembers}
                riskBands={riskBands}
                verdict={null}
                onSelect={(roleLabel) => toggleFamilyMember(roleLabel)}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 opacity-30">
                <Users size={32} style={{ color: "var(--ink-soft)" }} />
                <p className="text-xs" style={{ color: "var(--ink-soft)" }}>No members yet</p>
              </div>
            )}
          </div>

          <AnimatePresence>
            {selectedFamilyMembers.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                className="px-4 pb-4 flex items-center gap-2 flex-wrap justify-center shrink-0 relative z-10">
                <span className="text-[10px] font-semibold" style={{ color: "var(--primary)" }}>Focused on:</span>
                {selectedFamilyMembers.map(rl => {
                  const m = members.find(x => x.role_label === rl);
                  return (
                    <span key={rl} className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                      style={{ background: "var(--primary-tint)", color: "var(--primary)" }}>
                      {m?.display_name || rl}
                    </span>
                  );
                })}
                <button onClick={clearFamilySelection}
                  className="text-[10px] font-semibold hover:opacity-60 transition-opacity"
                  style={{ color: "var(--ink-faint)" }}>
                  Clear
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* RIGHT: Quick actions */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="flex flex-col gap-3 min-h-0 overflow-hidden"
        >
          <p className="text-xs font-bold uppercase tracking-wider shrink-0" style={{ color: "var(--ink-soft)" }}>
            Quick Actions
          </p>
          <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
            {QUICK_ACTIONS.map((a) => (
              <Link key={a.href} href={a.href}
                className="glass-card p-4 flex flex-col gap-2 hover:opacity-80 transition-opacity">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: "var(--primary-tint)" }}>
                  <a.Icon size={15} style={{ color: "var(--primary)" }} />
                </div>
                <div>
                  <p className="text-xs font-bold leading-snug" style={{ color: "var(--ink)" }}>{a.label}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--ink-faint)" }}>{a.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </motion.div>

      </div>
    </div>
  );
}
