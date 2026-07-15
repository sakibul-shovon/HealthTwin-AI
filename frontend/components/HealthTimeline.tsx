"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShieldAlert, Pill, Thermometer, Activity, Info } from "lucide-react";

interface TimelineEvent {
  id: number;
  event_type: string;
  detail: Record<string, any>;
  created_at: string;
}

interface Props {
  memberId: number;
  memberName: string;
  onClose: () => void;
}

const EVT_CONFIG: Record<string, { Icon: any; color: string; bg: string }> = {
  safety_alert:       { Icon: ShieldAlert,  color: "var(--urgent)", bg: "var(--urgent-bg)" },
  medication_added:   { Icon: Pill,         color: "var(--well)",   bg: "var(--well-bg)"   },
  medication_removed: { Icon: Pill,         color: "var(--watch)",  bg: "var(--watch-bg)"  },
  symptom_logged:     { Icon: Thermometer,  color: "var(--watch)",  bg: "var(--watch-bg)"  },
  condition_added:    { Icon: Activity,     color: "var(--info)",   bg: "var(--info-bg)"   },
};
const DEFAULT_CFG = { Icon: Info, color: "var(--info)", bg: "var(--info-bg)" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function eventLabel(evt: TimelineEvent): string {
  const d = evt.detail ?? {};
  switch (evt.event_type) {
    case "safety_alert":
      return `${d.drug ?? "Drug"} flagged — ${d.verdict ?? "conflict"}`;
    case "medication_added":
      return `${d.name ?? "Medication"} ${d.dose ? "(" + d.dose + ")" : ""} added`;
    case "medication_removed":
      return `${d.name ?? "Medication"} removed`;
    case "symptom_logged":
      return `Symptom: ${d.symptom ?? d.name ?? "recorded"}`;
    case "condition_added":
      return `Condition added: ${d.name ?? "unknown"}`;
    default:
      return evt.event_type.replace(/_/g, " ");
  }
}

export default function HealthTimeline({ memberId, memberName, onClose }: Props) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("ht-token");
        const res = await fetch(`/api/member/${memberId}/timeline`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) setEvents(await res.json());
      } catch {}
      setLoading(false);
    })();
  }, [memberId]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        style={{ background: "rgba(10,20,22,0.72)", backdropFilter: "blur(8px)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 16 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="w-full max-w-2xl rounded-3xl overflow-hidden"
          style={{
            background: "var(--surface-raised)",
            border: "1.5px solid var(--border-strong)",
            boxShadow: "var(--shadow-lg)",
            maxHeight: "85vh",
            display: "flex",
            flexDirection: "column",
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Accent line */}
          <div className="h-[2px] shrink-0"
            style={{ background: "linear-gradient(90deg, var(--primary), var(--accent))" }} />

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 shrink-0"
            style={{ borderBottom: "1px solid var(--border)" }}>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: "var(--primary)" }}>
                Health Timeline
              </p>
              <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>{memberName}</p>
            </div>
            <button onClick={onClose} className="hover:opacity-60 transition-opacity" style={{ color: "var(--ink-faint)" }}>
              <X size={15} />
            </button>
          </div>

          {/* Timeline body */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {loading ? (
              <div className="flex flex-col gap-3">
                {[0, 1, 2, 3].map(i => (
                  <motion.div key={i} className="h-12 rounded-xl"
                    style={{ background: "var(--surface-muted)" }}
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <Activity size={28} style={{ color: "var(--ink-faint)", opacity: 0.4 }} />
                <p className="text-sm" style={{ color: "var(--ink-faint)" }}>No health events recorded yet</p>
                <p className="text-[10px] text-center" style={{ color: "var(--ink-faint)" }}>
                  Events appear here when Samantha logs safety alerts, medications, or symptoms.
                </p>
              </div>
            ) : (
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-3 top-2 bottom-2 w-[1.5px]"
                  style={{ background: "var(--border-strong)", opacity: 0.4 }} />

                <div className="flex flex-col gap-4">
                  {events.map((evt, i) => {
                    const cfg = EVT_CONFIG[evt.event_type] ?? DEFAULT_CFG;
                    return (
                      <motion.div
                        key={evt.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-start gap-3 pl-1"
                      >
                        {/* Dot on timeline */}
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 relative z-10"
                          style={{ background: cfg.bg, border: `1.5px solid ${cfg.color}55` }}
                        >
                          <cfg.Icon size={10} style={{ color: cfg.color }} />
                        </div>

                        <div className="flex-1 min-w-0 pb-1">
                          <div className="flex items-baseline gap-2 mb-0.5">
                            <p className="text-[12px] font-semibold leading-tight" style={{ color: "var(--ink)" }}>
                              {eventLabel(evt)}
                            </p>
                          </div>
                          <p className="text-[10px]" style={{ color: "var(--ink-faint)" }}>
                            {formatDate(evt.created_at)}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="px-5 py-3 shrink-0 flex items-center justify-between"
            style={{ borderTop: "1px solid var(--border)", background: "var(--surface-muted)" }}>
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--primary)" }}>
              HealthTwin AI
            </p>
            <p className="text-[9px]" style={{ color: "var(--ink-faint)" }}>
              {events.length} event{events.length !== 1 ? "s" : ""} recorded
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
