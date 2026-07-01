"use client";

import { useEffect } from "react";
import { getHousehold } from "@/lib/api";
import { useTwinStore } from "@/lib/store";
import { ResponseEnvelope } from "@/lib/types";
import MemberRail from "@/components/MemberRail";
import Constellation from "@/components/Constellation";
import VoiceOrb from "@/components/VoiceOrb";
import VerdictCard from "@/components/VerdictCard";
import VoicePanel from "@/components/VoicePanel";

export default function Home() {
  const {
    household,
    activeMember,
    orbState,
    lastResponse,
    transcript,
    setHousehold,
    setActiveMember,
    setOrbState,
  } = useTwinStore();

  useEffect(() => {
    getHousehold().then((data) => {
      if (data) setHousehold(data);
    });
  }, [setHousehold]);

  const members = household?.members ?? [];
  const focusedMember = (lastResponse as ResponseEnvelope | null)?.member_focus ?? null;

  function handleOrbClick() {
    if (orbState === "idle") setOrbState("listening");
    else if (orbState === "listening") setOrbState("idle");
  }

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ backgroundColor: "var(--canvas)" }}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between px-6 py-3 shrink-0"
        style={{
          backgroundColor: "var(--primary)",
          borderBottom: "1px solid var(--primary-deep)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
            style={{ backgroundColor: "var(--accent)", color: "white" }}
          >
            HT
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight text-white">HealthTwin</h1>
            <p className="text-[11px]" style={{ color: "var(--primary-tint)" }}>
              Family Command Center
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {household && (
            <span
              className="text-xs px-2.5 py-1 rounded-full"
              style={{ backgroundColor: "var(--primary-deep)", color: "var(--primary-tint)" }}
            >
              {household.name}
            </span>
          )}
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: Member Rail */}
        <div
          className="w-56 shrink-0 overflow-y-auto"
          style={{ borderRight: "1px solid var(--surface-sunk)" }}
        >
          {members.length > 0 ? (
            <MemberRail
              members={members}
              activeMember={activeMember}
              onSelect={(label) => setActiveMember(label)}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-xs" style={{ color: "var(--ink-faint)" }}>
                Loading family…
              </p>
            </div>
          )}
        </div>

        {/* Center: Living Twin */}
        <div className="flex-1 flex flex-col items-center justify-between py-6 px-4 overflow-hidden">
          {/* Constellation + Orb */}
          <div className="flex-1 flex flex-col items-center justify-center relative">
            {members.length > 0 && (
              <div className="relative">
                {/* Constellation nodes are positioned around the orb */}
                <Constellation
                  members={members}
                  focusedMember={focusedMember}
                  activeMember={activeMember}
                  onSelect={(label) => setActiveMember(label)}
                />
                {/* Orb sits in the center of the constellation */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <VoiceOrb onClick={handleOrbClick} />
                </div>
              </div>
            )}
            {members.length === 0 && (
              <VoiceOrb onClick={handleOrbClick} />
            )}
          </div>

          {/* Transcript hint */}
          {transcript && (
            <p
              className="text-xs text-center px-4 mb-2 truncate max-w-xs"
              style={{ color: "var(--ink-faint)" }}
            >
              &ldquo;{transcript}&rdquo;
            </p>
          )}

          {/* Voice Panel */}
          <div
            className="w-full max-w-lg rounded-2xl p-4"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--surface-sunk)",
            }}
          >
            <VoicePanel />
          </div>
        </div>

        {/* Right: Verdict Panel */}
        <div
          className="w-80 shrink-0 overflow-y-auto p-4"
          style={{ borderLeft: "1px solid var(--surface-sunk)" }}
        >
          <h2
            className="text-xs font-semibold uppercase tracking-widest mb-3"
            style={{ color: "var(--ink-faint)" }}
          >
            Verdict
          </h2>
          <VerdictCard response={lastResponse as ResponseEnvelope | null} />
        </div>
      </div>
    </div>
  );
}
