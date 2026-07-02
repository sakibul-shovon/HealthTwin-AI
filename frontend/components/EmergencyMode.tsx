"use client";
import { useEffect, useState } from "react";
import { useTwinStore } from "@/lib/store";
import { getEmergencyCard } from "@/lib/api";
import { CriticalInfo } from "@/lib/types";
import { motion } from "framer-motion";

interface Props {
  onAction: (action: any) => Promise<void>;
}

export default function EmergencyMode({ onAction }: Props) {
  const { emergencyActive, emergencyData, setEmergency, household } = useTwinStore();
  const [critical, setCritical] = useState<CriticalInfo | null>(null);

  useEffect(() => {
    if (!emergencyActive || !emergencyData) return;
    
    const memberName = emergencyData.member_focus;
    if (!memberName) return;

    const member = household?.members.find(m => m.role_label === memberName);
    
    if (emergencyData.display.critical) {
      setCritical(emergencyData.display.critical);
      if (member) {
        localStorage.setItem(`emergency_card_${member.id}`, JSON.stringify(emergencyData.display.critical));
      }
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

  if (!emergencyActive || !emergencyData) return null;

  const title = emergencyData.display.conflict || "EMERGENCY DETECTED";
  const memberName = emergencyData.member_focus || "Member";
  const actions = emergencyData.actions || [];

  return (
    <motion.div 
      className="fixed inset-0 z-[100] flex flex-col p-6"
      style={{ backgroundColor: "rgba(248, 225, 228, 0.95)", backdropFilter: "blur(8px)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div 
        className="absolute inset-0 pointer-events-none"
        style={{ border: "8px solid var(--urgent)", opacity: 0.5 }}
        animate={{ opacity: [0.3, 0.8, 0.3] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      />
      
      <div className="relative z-10 flex-1 flex flex-col gap-6 max-w-lg mx-auto w-full pt-10">
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-16 h-16 rounded-full flex items-center justify-center bg-red-600 text-white text-3xl mb-2 shadow-lg">
            !
          </div>
          <h1 className="text-3xl font-black uppercase text-red-700 tracking-wider">
            {title}
          </h1>
          <p className="text-xl font-bold text-red-900 bg-red-100 px-4 py-1 rounded-full border border-red-300">
            {memberName}
          </p>
        </div>

        {critical ? (
          <div className="bg-white rounded-2xl p-5 shadow-xl flex flex-col gap-4 border-2 border-red-200">
            <h2 className="font-bold text-red-800 uppercase text-xs tracking-widest border-b border-red-100 pb-2">
              Critical Information
            </h2>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 block text-xs">Age</span>
                <span className="font-semibold text-gray-900">{critical.age} yrs</span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs">Blood Group</span>
                <span className="font-semibold text-gray-900">{critical.blood_group || "Unknown"}</span>
              </div>
              
              <div className="col-span-2">
                <span className="text-gray-500 block text-xs">Medical Conditions</span>
                <span className="font-semibold text-gray-900">{critical.conditions.length ? critical.conditions.join(", ") : "None"}</span>
              </div>
              
              <div className="col-span-2">
                <span className="text-gray-500 block text-xs">Medications</span>
                <span className="font-semibold text-gray-900">{critical.medications.length ? critical.medications.join(", ") : "None"}</span>
              </div>
              
              <div className="col-span-2">
                <span className="text-red-500 font-bold block text-xs">Allergies</span>
                <span className="font-semibold text-red-700">{critical.allergies.length ? critical.allergies.join(", ") : "None"}</span>
              </div>

              {critical.flags.length > 0 && (
                <div className="col-span-2">
                  <span className="text-red-500 font-bold block text-xs">System Flags</span>
                  <span className="font-semibold text-red-700 uppercase">{critical.flags.join(", ")}</span>
                </div>
              )}
              
              <div className="col-span-2">
                <span className="text-gray-500 block text-xs">Primary Caregiver</span>
                <span className="font-semibold text-gray-900">{critical.caregiver}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-5 shadow-xl flex flex-col items-center justify-center border border-red-200 h-40">
            <p className="text-gray-500 italic text-sm">Loading critical data...</p>
          </div>
        )}

        <div className="flex flex-col gap-3 mt-auto pb-6">
          {actions.map((act, i) => {
            if (act.type === "call_emergency") {
              return (
                <a key={i} href={`tel:${act.target}`} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl shadow-lg flex justify-center items-center gap-2 text-lg transition-colors">
                  📞 {act.label}
                </a>
              );
            }
            if (act.type === "nearest_hospital") {
              return (
                <a key={i} href={act.target || "#"} target="_blank" rel="noopener noreferrer" className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 rounded-xl shadow-lg flex justify-center items-center gap-2 text-lg transition-colors">
                  🏥 {act.label}
                </a>
              );
            }
            if (act.type === "notify_caregiver") {
              return (
                <button key={i} onClick={() => onAction(act)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg flex justify-center items-center gap-2 text-lg transition-colors">
                  ⚠️ {act.label}
                </button>
              );
            }
            return (
              <button key={i} onClick={() => onAction(act)} className="w-full bg-gray-800 hover:bg-gray-900 text-white font-bold py-4 rounded-xl shadow flex justify-center items-center text-lg transition-colors">
                {act.label}
              </button>
            );
          })}
          
          <button 
            onClick={() => setEmergency(false, null)} 
            className="w-full mt-2 bg-white hover:bg-red-50 text-red-800 font-semibold py-4 rounded-xl border-2 border-red-200 transition-colors shadow-sm"
          >
            Back / Handled
          </button>
        </div>
      </div>
    </motion.div>
  );
}
