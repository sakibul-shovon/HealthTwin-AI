"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Printer, AlertTriangle, Pill, Activity, Shield, Droplets, User } from "lucide-react";

interface CriticalInfo {
  medications: string[];
  allergies: string[];
  conditions: string[];
  flags: string[];
  blood_group: string | null;
  age: number;
  caregiver: string;
}

interface Props {
  memberId: number;
  memberName: string;
  onClose: () => void;
}

export default function EmergencyCard({ memberId, memberName, onClose }: Props) {
  const [data, setData] = useState<CriticalInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("ht-token");
        const res = await fetch(`/api/emergency/${memberId}/card`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) setData(await res.json());
      } catch {}
      setLoading(false);
    })();
  }, [memberId]);

  // QR encodes a concise emergency summary
  const qrPayload = data
    ? encodeURIComponent(
        `EMERGENCY:${memberName}|Age:${data.age}|Blood:${data.blood_group ?? "?"}|` +
        `Meds:${data.medications.join(",")}|Allergy:${data.allergies.join(",")}|` +
        `Conditions:${data.conditions.join(",")}|Flags:${data.flags.join(",")}|` +
        `Caregiver:${data.caregiver}`
      )
    : "";

  const qrUrl = qrPayload
    ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${qrPayload}&ecc=M`
    : null;

  function handlePrint() {
    window.print();
  }

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
          className="relative w-full max-w-2xl rounded-3xl overflow-hidden"
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
          {/* Red top accent */}
          <div
            className="h-1 w-full"
            style={{ background: "linear-gradient(90deg, #BF3348, #E2922F, #BF3348)" }}
          />

          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "var(--urgent-bg)" }}
              >
                <AlertTriangle size={15} style={{ color: "var(--urgent)" }} />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: "var(--urgent)" }}>
                  Emergency Card
                </p>
                <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>{memberName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-opacity hover:opacity-70"
                style={{ background: "var(--primary-tint)", color: "var(--primary)" }}
              >
                <Printer size={11} /> Print
              </button>
              <button onClick={onClose} className="transition-opacity hover:opacity-60" style={{ color: "var(--ink-faint)" }}>
                <X size={15} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <motion.div
                className="w-6 h-6 rounded-full border-2 border-t-transparent"
                style={{ borderColor: "var(--primary)" }}
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
              />
            </div>
          ) : !data ? (
            <p className="text-center py-8 text-sm" style={{ color: "var(--ink-faint)" }}>
              Could not load emergency card
            </p>
          ) : (
            <div className="p-5 flex gap-4 overflow-y-auto flex-1">
              {/* Left: info */}
              <div className="flex-1 flex flex-col gap-3 min-w-0">
                {/* Age + Blood */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: "var(--info-bg)" }}>
                    <User size={11} style={{ color: "var(--info)" }} />
                    <span className="text-[11px] font-bold" style={{ color: "var(--info)" }}>Age {data.age}</span>
                  </div>
                  {data.blood_group && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: "var(--urgent-bg)" }}>
                      <Droplets size={11} style={{ color: "var(--urgent)" }} />
                      <span className="text-[11px] font-bold" style={{ color: "var(--urgent)" }}>{data.blood_group}</span>
                    </div>
                  )}
                </div>

                {/* Medications */}
                {data.medications.length > 0 && (
                  <Section icon={<Pill size={11} />} title="Current Medications" color="var(--well)" bg="var(--well-bg)">
                    {data.medications.map((m, i) => <Item key={i} text={m} />)}
                  </Section>
                )}

                {/* Allergies */}
                {data.allergies.length > 0 && (
                  <Section icon={<AlertTriangle size={11} />} title="Allergies" color="var(--urgent)" bg="var(--urgent-bg)">
                    {data.allergies.map((a, i) => <Item key={i} text={a} urgent />)}
                  </Section>
                )}

                {/* Conditions */}
                {data.conditions.length > 0 && (
                  <Section icon={<Activity size={11} />} title="Conditions" color="var(--watch)" bg="var(--watch-bg)">
                    {data.conditions.map((c, i) => <Item key={i} text={c} />)}
                  </Section>
                )}

                {/* Flags */}
                {data.flags.length > 0 && (
                  <Section icon={<Shield size={11} />} title="Risk Flags" color="var(--watch)" bg="var(--watch-bg)">
                    {data.flags.map((f, i) => <Item key={i} text={f} />)}
                  </Section>
                )}

                {/* Caregiver */}
                <p className="text-[10px]" style={{ color: "var(--ink-faint)" }}>
                  Caregiver: <span className="font-semibold" style={{ color: "var(--ink-soft)" }}>{data.caregiver}</span>
                </p>
              </div>

              {/* Right: QR */}
              {qrUrl && (
                <div className="shrink-0 flex flex-col items-center gap-1.5">
                  <div
                    className="p-2 rounded-xl"
                    style={{ background: "var(--surface-muted)", border: "1px solid var(--border)" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrUrl}
                      alt="Emergency QR"
                      width={120}
                      height={120}
                      style={{ display: "block", borderRadius: 4 }}
                    />
                  </div>
                  <p className="text-[9px] text-center font-medium" style={{ color: "var(--ink-faint)", maxWidth: 90 }}>
                    Scan for critical info
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div
            className="px-5 py-3 flex items-center justify-between"
            style={{ borderTop: "1px solid var(--border)", background: "var(--surface-muted)" }}
          >
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--primary)" }}>
              HealthTwin AI · Bangladesh
            </p>
            <p className="text-[9px]" style={{ color: "var(--ink-faint)" }}>
              Show to treating physician
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Section({ icon, title, color, bg, children }: {
  icon: React.ReactNode; title: string; color: string; bg: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <div className="w-4 h-4 rounded flex items-center justify-center" style={{ background: bg, color }}>
          {icon}
        </div>
        <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color }}>
          {title}
        </p>
      </div>
      <div className="flex flex-col gap-0.5 pl-5">{children}</div>
    </div>
  );
}

function Item({ text, urgent = false }: { text: string; urgent?: boolean }) {
  return (
    <p
      className="text-[11px] font-medium"
      style={{ color: urgent ? "var(--urgent)" : "var(--ink-soft)" }}
    >
      {urgent ? "⚠ " : "• "}{text}
    </p>
  );
}
