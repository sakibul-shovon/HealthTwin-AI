"use client";

import { useEffect, useState } from "react";
import { getMemberTwin, getMemberTimeline, generateReport } from "@/lib/api";
import { MemberTwinData, HealthEvent, ReportData } from "@/lib/types";
import ReportView from "@/components/ReportView";
import PageHeader from "@/components/shell/PageHeader";
import FamilyManager from "@/components/FamilyManager";
import { ArrowLeft, Pill, Stethoscope, AlertTriangle, FileText, Activity } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

const REPORT_TYPES = [
  { type: "family_summary",   label: "Family Summary",    icon: <FileText size={14}/> },
  { type: "medication_report", label: "Medications",       icon: <Pill size={14}/> },
  { type: "disease_history",  label: "Disease History",   icon: <Stethoscope size={14}/> },
  { type: "emergency_summary",label: "Emergency Card",    icon: <AlertTriangle size={14}/> },
  { type: "doctor_visit",     label: "Doctor Visit",      icon: <Activity size={14}/> },
  { type: "monthly",          label: "Monthly Report",    icon: <FileText size={14}/> },
];

export default function MemberTwinPage({ params }: { params: { memberId: string } }) {
  const memberId = parseInt(params.memberId, 10);
  const [twin, setTwin] = useState<MemberTwinData | null>(null);
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeReport, setActiveReport] = useState<ReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [isManagerOpen, setManagerOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getMemberTwin(memberId),
      getMemberTimeline(memberId)
    ]).then(([twinData, timelineData]) => {
      setTwin(twinData);
      setEvents(timelineData);
      setLoading(false);
    });
  }, [memberId]);

  const handleGenerateReport = async (type: string) => {
    setReportLoading(true);
    const data = await generateReport(type, memberId);
    if (data) setActiveReport(data as ReportData);
    setReportLoading(false);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <p className="text-sm font-medium animate-pulse" style={{ color: "var(--ink-soft)" }}>Loading Twin...</p>
      </div>
    );
  }

  if (!twin) {
    return (
      <div className="flex-1 flex items-center justify-center h-full flex-col gap-4">
        <p className="text-sm font-bold" style={{ color: "var(--urgent)" }}>Failed to load member twin.</p>
        <Link href="/family" className="text-sm underline" style={{ color: "var(--primary)" }}>Return to Family</Link>
      </div>
    );
  }

  const bandStyles = {
    LOW: { bg: "var(--well-bg)", text: "var(--well)" },
    MED: { bg: "var(--watch-bg)", text: "var(--watch)" },
    HIGH: { bg: "var(--urgent-bg)", text: "var(--urgent)" }
  };
  const currentRisk = bandStyles[twin.risk_band as keyof typeof bandStyles] || bandStyles.MED;

  return (
    <div className="flex flex-col min-h-full pb-10">
      <FamilyManager
        isOpen={isManagerOpen}
        onClose={() => setManagerOpen(false)}
        initialMemberId={memberId}
      />

      <PageHeader
        title={twin.member}
        subtitle={`${twin.age} yrs • ${twin.sex} ${twin.caregiver ? `• Caregiver: ${twin.caregiver}` : ""}`}
        action={
          <div className="flex items-center gap-2">
            <Link href="/family" className="text-xs font-bold px-3 py-1.5 rounded-lg mr-2 transition-colors flex items-center gap-1" style={{ background: "var(--surface-sunk)", color: "var(--ink-soft)" }}>
               <ArrowLeft size={14} /> Back
            </Link>
            <button
              onClick={() => setManagerOpen(true)}
              className="text-xs font-bold px-4 py-1.5 rounded-lg transition-colors"
              style={{ background: "var(--surface-sunk)", color: "var(--ink)" }}
            >
              Edit Profile
            </button>
            <Link href="/emergency" className="text-xs font-bold px-4 py-1.5 rounded-lg transition-colors" style={{ background: "var(--urgent-bg)", color: "var(--urgent)" }}>
              Emergency Card
            </Link>
          </div>
        }
      />
      
      <div className="px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Risk & Summary (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="glass-card p-5 border-t-4" style={{ borderTopColor: currentRisk.text }}>
             <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Risk Status</h3>
                <span className="text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider" style={{ background: currentRisk.bg, color: currentRisk.text }}>
                  {twin.risk_band} RISK
                </span>
             </div>
             
             {twin.risk_factors.length > 0 ? (
               <div className="flex flex-wrap gap-2 mb-4">
                 {twin.risk_factors.map(f => (
                   <span key={f} className="text-[10px] font-bold uppercase px-2 py-1 rounded-md" style={{ background: "var(--urgent-bg)", color: "var(--urgent)" }}>
                     {f.replace(/_/g, ' ')}
                   </span>
                 ))}
               </div>
             ) : (
               <p className="text-xs italic mb-4" style={{ color: "var(--ink-faint)" }}>No active risk factors.</p>
             )}
             
             <h4 className="text-xs font-bold uppercase tracking-wide mt-4 mb-2" style={{ color: "var(--primary)" }}>AI Twin Summary</h4>
             <p className="text-sm font-medium leading-relaxed" style={{ color: "var(--ink)" }}>{twin.ai_summary}</p>
          </div>

          <div className="glass-card p-5">
             <h3 className="text-sm font-bold uppercase tracking-wide mb-4" style={{ color: "var(--ink-soft)" }}>Member Reports</h3>
             <div className="grid grid-cols-1 gap-2">
               {REPORT_TYPES.map(({ type, label, icon }) => (
                 <button
                   key={type}
                   onClick={() => handleGenerateReport(type)}
                   disabled={reportLoading}
                   className="flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors hover:opacity-70 disabled:opacity-50"
                   style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--ink)" }}
                 >
                   <span style={{ color: "var(--primary)" }}>{icon}</span>
                   <span className="text-xs font-semibold flex-1">{label}</span>
                 </button>
               ))}
             </div>
             {reportLoading && (
               <p className="text-[11px] font-bold text-center mt-3 animate-pulse" style={{ color: "var(--primary)" }}>Generating report…</p>
             )}
          </div>
        </div>

        {/* Main Column: Records & Timeline (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             {/* Medications */}
             <div className="glass-card p-5 flex flex-col">
               <h3 className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 mb-3" style={{ color: "var(--ink-soft)" }}>
                 <Pill size={14} style={{ color: "var(--primary)" }} /> Medications
               </h3>
               {twin.medications.length > 0 ? (
                 <div className="flex flex-col gap-2">
                   {twin.medications.map(m => (
                     <div key={m} className="px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: "var(--surface-sunk)", color: "var(--ink)" }}>
                       {m}
                     </div>
                   ))}
                 </div>
               ) : <p className="text-xs italic" style={{ color: "var(--ink-faint)" }}>No active medications.</p>}
             </div>
             
             {/* Conditions */}
             <div className="glass-card p-5 flex flex-col">
               <h3 className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 mb-3" style={{ color: "var(--ink-soft)" }}>
                 <Stethoscope size={14} style={{ color: "var(--primary)" }} /> Conditions
               </h3>
               {twin.conditions.length > 0 ? (
                 <div className="flex flex-col gap-2">
                   {twin.conditions.map(c => (
                     <div key={c} className="px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: "var(--surface-sunk)", color: "var(--ink)" }}>
                       {c}
                     </div>
                   ))}
                 </div>
               ) : <p className="text-xs italic" style={{ color: "var(--ink-faint)" }}>None recorded.</p>}
             </div>
             
             {/* Allergies */}
             <div className="glass-card p-5 flex flex-col">
               <h3 className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 mb-3" style={{ color: "var(--ink-soft)" }}>
                 <AlertTriangle size={14} style={{ color: "var(--urgent)" }} /> Allergies
               </h3>
               {twin.allergies.length > 0 ? (
                 <div className="flex flex-col gap-2">
                   {twin.allergies.map(a => (
                     <div key={a} className="px-3 py-2 rounded-lg text-xs font-bold" style={{ background: "var(--urgent-bg)", color: "var(--urgent)" }}>
                       {a}
                     </div>
                   ))}
                 </div>
               ) : <p className="text-xs italic" style={{ color: "var(--ink-faint)" }}>None recorded.</p>}
             </div>
          </div>
          
          {/* Timeline */}
          <div className="glass-card p-6 flex-1">
             <h3 className="text-sm font-bold uppercase tracking-wide mb-6" style={{ color: "var(--ink-soft)" }}>Recent Events</h3>
             {events.length > 0 ? (
               <div className="flex flex-col gap-0 relative">
                 <div className="absolute left-[11px] top-2 bottom-6 w-[2px] rounded-full" style={{ background: "var(--border)" }}></div>
                 {events.map((ev, i) => (
                   <div key={ev.id} className="flex gap-4 relative pb-6 z-10">
                     <div className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center font-bold text-[10px] mt-0.5" style={{ background: "var(--surface)", border: "2px solid var(--border)", color: "var(--primary)" }}>
                       {ev.event_type === 'safety_alert' ? '⚠' : ev.event_type === 'symptom_logged' ? '🤒' : '📝'}
                     </div>
                     <div className="flex-1">
                       <div className="flex justify-between items-center">
                         <p className="text-xs font-bold capitalize" style={{ color: "var(--ink)" }}>{ev.event_type.replace('_', ' ')}</p>
                         <p className="text-[10px] font-bold tracking-wider uppercase" style={{ color: "var(--ink-faint)" }}>
                           {new Date(ev.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                         </p>
                       </div>
                       {ev.detail && (
                         <div className="mt-2 text-xs font-medium px-3 py-2.5 rounded-lg border" style={{ background: "var(--surface-sunk)", borderColor: "var(--border)", color: "var(--ink-soft)" }}>
                           {ev.event_type === 'safety_alert' ? (
                             <span style={{ color: "var(--urgent)" }}>{ev.detail.drug}: {ev.detail.conflict}</span>
                           ) : ev.event_type === 'symptom_logged' ? (
                             <span>{ev.detail.symptom} {ev.detail.severity ? `(${ev.detail.severity})` : ''}</span>
                           ) : ev.event_type === 'medication_added' ? (
                             <span>Added: {ev.detail.name} {ev.detail.dose}</span>
                           ) : (
                             JSON.stringify(ev.detail)
                           )}
                         </div>
                       )}
                     </div>
                   </div>
                 ))}
               </div>
             ) : (
               <p className="text-xs italic" style={{ color: "var(--ink-faint)" }}>No recent events.</p>
             )}
          </div>
          
        </div>
      </div>
      
      {/* Full screen report preview overlay */}
      <AnimatePresence>
        {activeReport && (
          <motion.div
            className="fixed inset-0 z-[100] flex flex-col"
            style={{ background: "var(--canvas)" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <ReportView report={activeReport} onClose={() => setActiveReport(null)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
