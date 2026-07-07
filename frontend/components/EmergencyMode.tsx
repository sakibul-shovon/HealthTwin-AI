"use client";
import { useEffect, useState } from "react";
import { useTwinStore } from "@/lib/store";
import { getEmergencyCard } from "@/lib/api";
import { CriticalInfo } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import { X, Phone, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  onAction: (action: any) => Promise<void>;
}

export default function EmergencyMode({ onAction }: Props) {
  const { emergencyActive, emergencyData, setEmergency, household } = useTwinStore();
  const [critical, setCritical] = useState<CriticalInfo | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!emergencyActive || !emergencyData) { setCritical(null); return; }

    const member = household?.members.find(m => m.role_label === emergencyData.member_focus);

    if (emergencyData.display.critical) {
      setCritical(emergencyData.display.critical);
      if (member) localStorage.setItem(`emergency_card_${member.id}`, JSON.stringify(emergencyData.display.critical));
    } else if (member) {
      getEmergencyCard(member.id).then((card) => {
        if (card) {
          setCritical(card);
          localStorage.setItem(`emergency_card_${member.id}`, JSON.stringify(card));
        } else {
          const cached = localStorage.getItem(`emergency_card_${member.id}`);
          if (cached) setCritical(JSON.parse(cached));
        }
      }).catch(() => {
        const cached = localStorage.getItem(`emergency_card_${member.id}`);
        if (cached) setCritical(JSON.parse(cached));
      });
    }
  }, [emergencyActive, emergencyData, household]);

  // Reset expanded state when a new emergency comes in
  useEffect(() => { if (emergencyActive) setExpanded(false); }, [emergencyActive]);

  const title      = emergencyData?.display.conflict || "EMERGENCY DETECTED";
  const memberName = emergencyData?.member_focus || "Member";
  const actions    = emergencyData?.actions || [];
  const callAction = actions.find(a => a.type === "call_emergency");
  const otherActions = actions.filter(a => a.type !== "call_emergency");

  return (
    <AnimatePresence>
      {emergencyActive && emergencyData && (
        <motion.div
          className="fixed top-4 right-4 z-[100] w-80"
          initial={{ opacity: 0, x: 60, scale: 0.96 }}
          animate={{ opacity: 1, x: 0,  scale: 1    }}
          exit=   {{ opacity: 0, x: 60, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 340, damping: 28 }}
        >
          {/* Pulsing ring behind the card */}
          <motion.div
            className="absolute -inset-1 rounded-[20px] pointer-events-none"
            style={{ background: "rgba(220,38,38,0.18)" }}
            animate={{ opacity: [0.4, 0.9, 0.4] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />

          <div className="relative rounded-2xl overflow-hidden shadow-2xl"
            style={{ border: "2px solid #DC2626", background: "var(--surface)" }}>

            {/* Header */}
            <div className="px-4 py-3 flex items-center gap-2.5"
              style={{ background: "#DC2626" }}>
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <AlertTriangle size={13} color="#fff" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-black text-xs uppercase tracking-widest leading-none">Emergency</p>
                <p className="text-white/90 font-semibold text-[11px] mt-0.5 truncate">{memberName}</p>
              </div>
              <button
                onClick={() => setEmergency(false, null)}
                className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/35 flex items-center justify-center transition-colors shrink-0"
                title="Dismiss"
              >
                <X size={13} color="#fff" />
              </button>
            </div>

            {/* Alert title */}
            <div className="px-4 pt-3 pb-2">
              <p className="font-bold text-sm leading-snug" style={{ color: "#991B1B" }}>
                {title}
              </p>
            </div>

            {/* Call button — always visible */}
            {callAction && (
              <div className="px-4 pb-3">
                <a
                  href={`tel:${callAction.target}`}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-white text-sm transition-all active:scale-95"
                  style={{ background: "#DC2626", boxShadow: "0 2px 12px rgba(220,38,38,0.35)" }}
                >
                  <Phone size={14} /> {callAction.label}
                </a>
              </div>
            )}

            {/* Expand toggle */}
            <button
              onClick={() => setExpanded(v => !v)}
              className="w-full flex items-center justify-center gap-1 py-2 text-[11px] font-semibold transition-colors"
              style={{
                borderTop: "1px solid rgba(220,38,38,0.15)",
                color: "#991B1B",
                background: "#FEF2F2",
              }}
            >
              {expanded ? <><ChevronUp size={12} /> Hide details</> : <><ChevronDown size={12} /> Show critical info</>}
            </button>

            {/* Expanded: critical info + other actions */}
            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 py-3 space-y-2.5" style={{ background: "#FEF2F2" }}>
                    {critical ? (
                      <>
                        {critical.conditions.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#9CA3AF" }}>Conditions</p>
                            <p className="text-xs font-semibold" style={{ color: "#1F2937" }}>{critical.conditions.join(", ")}</p>
                          </div>
                        )}
                        {critical.medications.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#9CA3AF" }}>Medications</p>
                            <p className="text-xs font-semibold" style={{ color: "#1F2937" }}>{critical.medications.join(", ")}</p>
                          </div>
                        )}
                        {critical.allergies.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#EF4444" }}>Allergies</p>
                            <p className="text-xs font-bold" style={{ color: "#B91C1C" }}>{critical.allergies.join(", ")}</p>
                          </div>
                        )}
                        {critical.flags.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#EF4444" }}>Flags</p>
                            <p className="text-xs font-bold uppercase" style={{ color: "#B91C1C" }}>{critical.flags.join(", ")}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#9CA3AF" }}>Caregiver</p>
                          <p className="text-xs font-semibold" style={{ color: "#1F2937" }}>{critical.caregiver}</p>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-center italic py-2" style={{ color: "#9CA3AF" }}>Loading critical data…</p>
                    )}

                    {/* Other actions */}
                    {otherActions.length > 0 && (
                      <div className="flex flex-col gap-2 pt-1">
                        {otherActions.map((act, i) => {
                          if (act.type === "nearest_hospital") {
                            return (
                              <a key={i} href={act.target || "#"} target="_blank" rel="noopener noreferrer"
                                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl font-bold text-white text-xs"
                                style={{ background: "#D97706" }}>
                                🏥 {act.label}
                              </a>
                            );
                          }
                          return (
                            <button key={i} onClick={() => onAction(act)}
                              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl font-bold text-white text-xs"
                              style={{ background: "#2563EB" }}>
                              ⚠️ {act.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
