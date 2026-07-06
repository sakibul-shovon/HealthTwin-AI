"use client";

import { useEffect, useState } from "react";
import { getMemberTwin, getMemberTimeline, generateReport } from "@/lib/api";
import { MemberTwinData, HealthEvent, ReportData } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import ReportView from "@/components/ReportView";

interface Props {
  memberId: number;
  onBack: () => void;
  onEdit?: (id: number) => void;
}

const REPORT_TYPES = [
  { type: "family_summary",   label: "Family Summary",    icon: "📄" },
  { type: "medication_report", label: "Medications",       icon: "📄" },
  { type: "disease_history",  label: "Disease History",   icon: "📄" },
  { type: "emergency_summary",label: "Emergency Card",    icon: "📄" },
  { type: "doctor_visit",     label: "Doctor Visit",      icon: "📄" },
  { type: "monthly",          label: "Monthly Report",    icon: "📄" },
];

export default function MemberTwin({ memberId, onBack, onEdit }: Props) {
  const [twin, setTwin] = useState<MemberTwinData | null>(null);
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState<ReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

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
    return <div className="h-full flex items-center justify-center text-slate-400 font-medium animate-pulse">Loading digital twin...</div>;
  }
  if (!twin) {
    return <div className="h-full flex items-center justify-center text-red-500 font-medium">Failed to load member twin.</div>;
  }

  const bandColors = {
    LOW: "bg-emerald-100 text-emerald-700 border-emerald-200",
    MED: "bg-amber-100 text-amber-700 border-amber-200",
    HIGH: "bg-red-100 text-red-700 border-red-200 shadow-sm"
  };

  return (
    <motion.div 
      className="h-full relative flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex justify-between items-center shrink-0">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-white text-lg shadow-sm">
            {twin.member.charAt(0)}
          </div>
          {twin.member}
        </h2>
        <div className="flex items-center gap-3">
           <div className={`px-3 py-1 rounded-full text-xs font-bold border tracking-widest ${bandColors[twin.risk_band]}`}>
             {twin.risk_band} RISK
           </div>
           {onEdit && (
             <button onClick={() => onEdit(memberId)} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
             </button>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[minmax(180px,auto)]">
        
        {/* Bento: Profile Details & Risk */}
        <div className="col-span-1 bg-slate-50 p-5 rounded-2xl flex flex-col gap-4 border border-slate-200">
           <div className="flex justify-between items-start">
             <div>
               <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Demographics</p>
               <p className="text-lg font-bold text-slate-800 mt-1">{twin.age} yrs • {twin.sex}</p>
             </div>
             {twin.caregiver && (
               <div className="text-right">
                 <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Caregiver</p>
                 <p className="text-sm font-semibold text-blue-600 mt-1">{twin.caregiver}</p>
               </div>
             )}
           </div>

           {twin.risk_factors.length > 0 && (
             <div className="mt-auto">
               <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">Risk Factors</p>
               <div className="flex flex-wrap gap-2">
                 {twin.risk_factors.map(f => (
                   <span key={f} className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold uppercase rounded-md shadow-sm">
                     {f.replace(/_/g, ' ')}
                   </span>
                 ))}
               </div>
             </div>
           )}
        </div>

        {/* Bento: AI Summary */}
        <div className={`col-span-1 md:col-span-2 bg-blue-50/50 p-5 rounded-2xl relative overflow-hidden border ${twin.risk_band === 'HIGH' ? 'border-red-200' : 'border-blue-100'}`}>
           <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
           <h3 className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-3 flex items-center gap-2">
             AI Twin Summary
           </h3>
           <p className="text-sm text-slate-700 leading-relaxed font-medium">{twin.ai_summary}</p>
        </div>

        {/* Bento: Conditions & Allergies */}
        <div className="col-span-1 md:col-span-2 grid grid-cols-2 gap-4">
           <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                 Conditions
              </h3>
              {twin.conditions.length > 0 ? (
                <ul className="text-sm text-slate-700 space-y-2 font-medium">
                  {twin.conditions.map(c => <li key={c} className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">•</span> {c}</li>)}
                </ul>
              ) : <span className="text-sm text-slate-400 italic">None logged</span>}
           </div>
           
           <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                 Allergies
              </h3>
              {twin.allergies.length > 0 ? (
                <ul className="text-sm text-red-600 font-semibold space-y-2">
                  {twin.allergies.map(a => <li key={a} className="flex items-start gap-2"><span className="text-red-400 mt-0.5">•</span> {a}</li>)}
                </ul>
              ) : <span className="text-sm text-slate-400 italic">None known</span>}
           </div>
        </div>

        {/* Bento: Timeline (Tall) */}
        <div className="col-span-1 row-span-2 bg-slate-50 border border-slate-200 p-5 rounded-2xl flex flex-col h-full overflow-hidden">
           <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
             Health Events
           </h3>
           <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-4">
             {events.length > 0 ? events.map((ev, i) => (
                <div key={ev.id} className="relative pl-6 pb-2">
                  {i !== events.length - 1 && <div className="absolute top-3 bottom-0 left-2 w-[1px] bg-slate-200"></div>}
                  <div className={`absolute left-0 top-1 w-4 h-4 rounded-full border-2 border-white z-10 ${ev.event_type === 'safety_alert' ? 'bg-red-500' : ev.event_type === 'symptom_logged' ? 'bg-amber-500' : 'bg-blue-500'}`}></div>
                  <p className="text-xs font-bold text-slate-800 capitalize">{ev.event_type.replace('_', ' ')}</p>
                  <p className="text-[10px] text-slate-400 mb-1">{new Date(ev.created_at).toLocaleDateString()}</p>
                  {ev.detail && (
                    <div className="text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-200">
                       {ev.event_type === 'safety_alert' ? <span className="text-red-600 font-medium">{ev.detail.drug}: {ev.detail.conflict}</span> : JSON.stringify(ev.detail).replace(/["{}]/g, '')}
                    </div>
                  )}
                </div>
             )) : <p className="text-xs text-slate-400 italic">No recent events.</p>}
           </div>
        </div>

        {/* Bento: Medications */}
        <div className="col-span-1 md:col-span-2 bg-slate-50 border border-slate-200 p-5 rounded-2xl">
           <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
             Active Medications ({twin.medications.length})
           </h3>
           <div className="flex flex-wrap gap-2">
             {twin.medications.length > 0 ? twin.medications.map(m => (
               <div key={m} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 flex items-center gap-2 shadow-sm">
                 <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                 {m}
               </div>
             )) : <p className="text-sm text-slate-400 italic">No active medications.</p>}
           </div>
        </div>

        {/* Bento: Export/Reports */}
        <div className="col-span-1 md:col-span-3 bg-slate-50 border border-slate-200 p-5 rounded-2xl flex flex-col gap-3">
           <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2">
             Export Medical Reports
           </h3>
           <div className="flex flex-wrap gap-3">
             {REPORT_TYPES.map(({ type, label, icon }) => (
               <button
                 key={type}
                 onClick={() => handleGenerateReport(type)}
                 disabled={reportLoading}
                 className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 transition-all shadow-sm disabled:opacity-50"
               >
                 <span className="text-sm">{icon}</span>
                 <span className="text-xs font-semibold">{label}</span>
               </button>
             ))}
             {reportLoading && <span className="text-xs text-blue-600 font-medium animate-pulse flex items-center ml-2">Generating...</span>}
           </div>
        </div>

      </div>

      <AnimatePresence>
        {activeReport && (
          <motion.div
            className="fixed inset-0 z-50 bg-white flex flex-col p-8"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
          >
            <ReportView report={activeReport} onClose={() => setActiveReport(null)} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
