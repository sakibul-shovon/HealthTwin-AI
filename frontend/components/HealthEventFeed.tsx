"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, Pill, Thermometer, Activity, AlertTriangle, Info } from "lucide-react";

interface HouseholdEvent {
  id: number;
  member: string;
  display_name: string;
  event_type: string;
  detail: Record<string, any>;
  created_at: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const EVENT_CONFIG: Record<string, { Icon: any; color: string; bg: string; label: string }> = {
  safety_alert:      { Icon: ShieldAlert,  color: "var(--urgent)", bg: "var(--urgent-bg)", label: "Safety Alert" },
  medication_added:  { Icon: Pill,         color: "var(--well)",   bg: "var(--well-bg)",   label: "Medication Added" },
  medication_removed:{ Icon: Pill,         color: "var(--watch)",  bg: "var(--watch-bg)",  label: "Medication Removed" },
  symptom_logged:    { Icon: Thermometer,  color: "var(--watch)",  bg: "var(--watch-bg)",  label: "Symptom Logged" },
  condition_added:   { Icon: Activity,     color: "var(--info)",   bg: "var(--info-bg)",   label: "Condition Added" },
  emergency:         { Icon: AlertTriangle,color: "var(--urgent)", bg: "var(--urgent-bg)", label: "Emergency" },
};
const DEFAULT_EVT = { Icon: Info, color: "var(--info)", bg: "var(--info-bg)", label: "Event" };

function eventSummary(evt: HouseholdEvent): string {
  const d = evt.detail ?? {};
  switch (evt.event_type) {
    case "safety_alert":
      return d.drug ? `${d.drug} flagged — ${d.conflict ?? d.verdict ?? "conflict detected"}` : "Safety conflict detected";
    case "medication_added":
      return d.name ? `${d.name}${d.dose ? " " + d.dose : ""} added` : "Medication added";
    case "medication_removed":
      return d.name ? `${d.name} removed` : "Medication removed";
    case "symptom_logged":
      return d.symptom ?? d.name ?? "Symptom logged";
    case "condition_added":
      return d.name ? `${d.name} added to record` : "Condition added";
    default:
      return JSON.stringify(d).slice(0, 60) || evt.event_type;
  }
}

export default function HealthEventFeed() {
  const [events, setEvents] = useState<HouseholdEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("ht-token") : null;
        const res = await fetch("/api/household/events?limit=8", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events ?? []);
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--ink-soft)" }}>
        Recent Activity
      </p>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="h-12 rounded-xl"
              style={{ background: "var(--surface-muted)" }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div
          className="rounded-xl px-4 py-4 text-center"
          style={{ background: "var(--surface-muted)", border: "1px dashed var(--border-strong)" }}
        >
          <p className="text-[11px]" style={{ color: "var(--ink-faint)" }}>
            No health events yet. Events appear here when Samantha logs safety alerts, medications, or symptoms.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {events.map((evt, i) => {
            const cfg = EVENT_CONFIG[evt.event_type] ?? DEFAULT_EVT;
            return (
              <motion.div
                key={evt.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="px-3 py-2.5 flex items-start gap-2.5 rounded-xl"
                style={{ background: "var(--surface-muted)", border: "1px solid var(--border)" }}
              >
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: cfg.bg }}
                >
                  <cfg.Icon size={11} style={{ color: cfg.color }} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] font-bold" style={{ color: "var(--primary)" }}>
                      {evt.display_name}
                    </span>
                    <span className="text-[9px]" style={{ color: "var(--ink-faint)" }}>
                      {timeAgo(evt.created_at)}
                    </span>
                  </div>
                  <p className="text-[11px] leading-snug" style={{ color: "var(--ink-soft)" }}>
                    {eventSummary(evt)}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
