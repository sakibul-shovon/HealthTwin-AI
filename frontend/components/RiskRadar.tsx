"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Shield, ShieldAlert, ShieldCheck, ShieldX, RefreshCw } from "lucide-react";

interface MemberScan {
  member: string;
  display_name: string;
  risk_level: "SAFE" | "CAUTION" | "UNSAFE";
  conflicts: { drug: string; type: string; detail: string; severity: string }[];
  checked_meds: number;
}

interface Props {
  onMemberClick?: (memberLabel: string) => void;
}

const LEVEL_CONFIG = {
  SAFE:    { Icon: ShieldCheck, color: "var(--well)",    bg: "var(--well-bg)",    label: "All clear" },
  CAUTION: { Icon: ShieldAlert, color: "var(--watch)",   bg: "var(--watch-bg)",  label: "Caution"   },
  UNSAFE:  { Icon: ShieldX,     color: "var(--urgent)",  bg: "var(--urgent-bg)", label: "Unsafe"    },
};

export default function RiskRadar({ onMemberClick }: Props) {
  const [scan, setScan] = useState<MemberScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("ht-token") : null;
      const res = await fetch("/api/household/risk-scan", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setScan(data.scan ?? []);
      }
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const flagged = scan.filter(m => m.risk_level !== "SAFE").length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--ink-soft)" }}>
            Family Safety Radar
          </p>
          {flagged > 0 && (
            <span
              className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
              style={{ background: "var(--urgent-bg)", color: "var(--urgent)" }}
            >
              {flagged} alert{flagged !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <button
          onClick={load}
          className="transition-opacity hover:opacity-60"
          style={{ color: "var(--ink-faint)" }}
        >
          <RefreshCw size={11} />
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="h-10 rounded-xl"
              style={{ background: "var(--surface-muted)" }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
      ) : scan.length === 0 ? (
        <p className="text-[11px] text-center py-3" style={{ color: "var(--ink-faint)" }}>
          No members to scan
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {scan.map((m, i) => {
            const cfg = LEVEL_CONFIG[m.risk_level] ?? LEVEL_CONFIG.SAFE;
            const isOpen = expanded === m.member;
            return (
              <motion.div
                key={m.member}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <button
                  className="w-full px-3 py-2.5 flex items-center gap-2.5 text-left hover:opacity-70 transition-opacity rounded-xl"
                  style={{ background: "var(--surface-muted)", border: "1px solid var(--border)" }}
                  onClick={() => setExpanded(isOpen ? null : m.member)}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: cfg.bg }}
                  >
                    <cfg.Icon size={13} style={{ color: cfg.color }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold leading-tight" style={{ color: "var(--ink)" }}>
                      {m.display_name}
                      <span className="ml-1 font-normal text-[10px]" style={{ color: "var(--ink-faint)" }}>
                        ({m.member})
                      </span>
                    </p>
                    {m.conflicts.length > 0 ? (
                      <p className="text-[10px] truncate" style={{ color: cfg.color }}>
                        {m.conflicts[0].detail}
                      </p>
                    ) : (
                      <p className="text-[10px]" style={{ color: "var(--ink-faint)" }}>
                        {m.checked_meds} med{m.checked_meds !== 1 ? "s" : ""} checked · no issues
                      </p>
                    )}
                  </div>

                  <span
                    className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0"
                    style={{ background: cfg.bg, color: cfg.color }}
                  >
                    {cfg.label}
                  </span>
                </button>

                {/* Expanded conflicts */}
                {isOpen && m.conflicts.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mx-1 mb-1 rounded-b-xl overflow-hidden"
                    style={{ background: "var(--surface-muted)", border: "1px solid var(--border)" }}
                  >
                    {m.conflicts.map((c, ci) => (
                      <div key={ci} className="px-3 py-2 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                        <p className="text-[10px] font-semibold" style={{ color: "var(--ink)" }}>
                          {c.drug} · <span className="uppercase">{c.type}</span>
                        </p>
                        <p className="text-[10px]" style={{ color: "var(--ink-soft)" }}>{c.detail}</p>
                      </div>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
