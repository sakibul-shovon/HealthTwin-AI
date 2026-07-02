"use client";

import { useEffect, useState } from "react";
import { getMemberTwin, getMemberTimeline } from "@/lib/api";
import { MemberTwinData, HealthEvent } from "@/lib/types";
import { motion } from "framer-motion";

interface Props {
  memberId: number;
  onBack: () => void;
}

export default function MemberTwin({ memberId, onBack }: Props) {
  const [twin, setTwin] = useState<MemberTwinData | null>(null);
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="flex-1 flex flex-col p-4 bg-white h-full relative border-l border-gray-100">
        <button onClick={onBack} className="absolute top-4 left-4 text-xs font-semibold text-gray-500 hover:text-gray-800 z-10">
          ← Back
        </button>
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400 animate-pulse">Loading digital twin...</div>
      </div>
    );
  }

  if (!twin) {
    return (
      <div className="flex-1 flex flex-col p-4 bg-white h-full relative border-l border-gray-100">
        <button onClick={onBack} className="absolute top-4 left-4 text-xs font-semibold text-gray-500 hover:text-gray-800 z-10">
          ← Back
        </button>
        <div className="flex-1 flex items-center justify-center text-sm text-red-500">Failed to load member twin.</div>
      </div>
    );
  }

  const bandColors = {
    LOW: "bg-green-100 text-green-800 border-green-200",
    MED: "bg-amber-100 text-amber-800 border-amber-200",
    HIGH: "bg-red-100 text-red-800 border-red-200"
  };

  return (
    <motion.div 
      className="flex flex-col h-full bg-white relative overflow-hidden"
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 20, opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between shrink-0 bg-gray-50">
        <button onClick={onBack} className="text-[11px] font-semibold text-gray-500 hover:text-gray-800 flex items-center gap-1 transition-colors px-2 py-1 rounded bg-gray-100 hover:bg-gray-200">
          <span>←</span> Back
        </button>
        <div className={`px-2 py-1 rounded text-[10px] font-bold border tracking-wider shadow-sm ${bandColors[twin.risk_band]}`}>
          {twin.risk_band} RISK
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 custom-scrollbar">
        {/* Profile Info */}
        <div className="flex flex-col items-center justify-center gap-2 mt-2">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-700 flex items-center justify-center text-2xl font-bold shadow-sm border border-indigo-200">
            {twin.member.charAt(0)}
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">{twin.member}</h2>
            <p className="text-xs text-gray-500 font-medium mt-0.5">{twin.age} yrs • {twin.sex} {twin.caregiver && `• Caregiver: ${twin.caregiver}`}</p>
          </div>
        </div>

        {/* AI Summary */}
        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-400"></div>
          <h3 className="text-[10px] font-bold text-blue-800 uppercase tracking-widest mb-1.5 flex items-center gap-1">
            <span className="text-[12px]">✨</span> AI Twin Summary
          </h3>
          <p className="text-xs text-blue-900/80 leading-relaxed font-medium">{twin.ai_summary}</p>
        </div>

        {/* Risk Factors */}
        {twin.risk_factors.length > 0 && (
          <div>
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Active Risk Factors</h3>
            <div className="flex flex-wrap gap-2">
              {twin.risk_factors.map(f => (
                <span key={f} className="px-2.5 py-1 bg-red-50 text-red-700 text-[10px] font-bold uppercase rounded-md border border-red-100 shadow-sm">
                  {f.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Medical State */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
              <span>🩺</span> Conditions
            </h3>
            {twin.conditions.length > 0 ? (
              <ul className="text-xs text-gray-700 space-y-1.5 font-medium">
                {twin.conditions.map(c => <li key={c} className="flex items-start gap-1"><span className="text-gray-300 mt-0.5">•</span> {c}</li>)}
              </ul>
            ) : <span className="text-xs text-gray-400 italic">None</span>}
          </div>
          
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
              <span>⚠️</span> Allergies
            </h3>
            {twin.allergies.length > 0 ? (
              <ul className="text-xs text-red-600 font-semibold space-y-1.5">
                {twin.allergies.map(a => <li key={a} className="flex items-start gap-1"><span className="text-red-300 mt-0.5">•</span> {a}</li>)}
              </ul>
            ) : <span className="text-xs text-gray-400 italic">None</span>}
          </div>
        </div>

        {/* Medications */}
        <div>
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center justify-between px-1">
            <span>💊 Medications ({twin.medications.length})</span>
          </h3>
          <div className="flex flex-col gap-2">
            {twin.medications.length > 0 ? twin.medications.map(m => (
              <div key={m} className="px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 shadow-sm flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0"></div>
                {m}
              </div>
            )) : <p className="text-xs text-gray-400 italic px-1">No active medications.</p>}
          </div>
        </div>

        {/* Timeline */}
        <div className="mt-2 pb-6">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 border-b border-gray-100 pb-2 px-1 flex items-center gap-1">
            <span>⏱️</span> Recent Events
          </h3>
          {events.length > 0 ? (
            <div className="flex flex-col gap-0 px-1">
              {events.slice(0, 5).map((ev, i) => (
                <div key={ev.id} className="flex gap-3 relative pb-4">
                  {i !== events.slice(0, 5).length - 1 && (
                    <div className="absolute top-6 bottom-0 left-[11px] w-[2px] bg-gray-100 rounded-full"></div>
                  )}
                  <div className="w-6 h-6 shrink-0 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center z-10 shadow-sm text-[10px]">
                    {ev.event_type === 'safety_alert' ? '⚠️' : ev.event_type === 'symptom_logged' ? '🤒' : '📝'}
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="text-xs font-bold text-gray-700 capitalize flex items-center justify-between">
                      {ev.event_type.replace('_', ' ')}
                      <span className="text-[9px] font-medium text-gray-400 uppercase tracking-wider">
                        {new Date(ev.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </p>
                    {ev.detail && (
                      <div className="mt-1.5 text-[11px] text-gray-600 bg-gray-50 p-2.5 rounded-lg border border-gray-100 font-medium">
                        {ev.event_type === 'safety_alert' ? (
                          <span className="text-red-700">{ev.detail.drug}: {ev.detail.conflict}</span>
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
            <p className="text-xs text-gray-400 italic px-1">No recent events.</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
