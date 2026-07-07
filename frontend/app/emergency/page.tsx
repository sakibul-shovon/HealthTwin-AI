"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/shell/PageHeader";
import { useTwinStore } from "@/lib/store";
import { getEmergencyCard } from "@/lib/api";
import { CriticalInfo } from "@/lib/types";
import { AlertTriangle, Phone, MapPin, Activity } from "lucide-react";

export default function EmergencyPage() {
  const { household } = useTwinStore();
  const members = household?.members || [];
  const [cards, setCards] = useState<Record<number, CriticalInfo | null>>({});

  useEffect(() => {
    const fetchCards = async () => {
      const data: Record<number, CriticalInfo | null> = {};
      for (const m of members) {
        try {
          const card = await getEmergencyCard(m.id);
          data[m.id] = card;
        } catch {
          data[m.id] = null;
        }
      }
      setCards(data);
    };
    if (members.length > 0) fetchCards();
  }, [household, members]);

  return (
    <div className="flex flex-col h-full overflow-hidden pb-10 relative bg-red-50/30">
      <PageHeader
        title="Emergency Info"
        subtitle="Critical medical information for first responders"
        action={
          <div className="flex gap-2">
            <a href="tel:911" className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-sm" style={{ background: "var(--urgent)", color: "white" }}>
              <Phone size={14} /> Call 911
            </a>
            <a href="https://maps.google.com/?q=hospital" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-sm" style={{ background: "var(--canvas)", color: "var(--ink)", border: "1px solid var(--border)" }}>
              <MapPin size={14} /> Nearest Hospital
            </a>
          </div>
        }
      />

      <div className="flex-1 px-6 py-6 overflow-y-auto custom-scrollbar">
        <div className="max-w-4xl mx-auto flex flex-col gap-6">
          {members.map(m => {
            const card = cards[m.id];
            return (
              <div key={m.id} className="bg-white rounded-2xl p-6 shadow-md border-t-8 flex flex-col" style={{ borderColor: "var(--urgent)" }}>
                <div className="flex justify-between items-start mb-6 pb-6 border-b" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-sm" style={{ background: "var(--urgent)" }}>
                      {m.role_label[0]}
                    </div>
                    <div>
                      <h2 className="text-2xl font-black uppercase tracking-wider" style={{ color: "var(--urgent)" }}>{m.role_label}</h2>
                      <p className="text-sm font-bold mt-1" style={{ color: "var(--ink-soft)" }}>
                        {m.display_name} • {card ? `${card.age} YRS • ${card.blood_group || "UNKNOWN TYPE"}` : `${m.age} YRS`}
                      </p>
                    </div>
                  </div>
                  <AlertTriangle size={32} style={{ color: "var(--urgent)" }} />
                </div>
                
                {card ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--urgent)" }}>Critical Medical Info</h3>
                      <div className="flex flex-col gap-4">
                        <div>
                          <p className="text-xs font-bold uppercase" style={{ color: "var(--ink-soft)" }}>Conditions</p>
                          <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>{card.conditions.length ? card.conditions.join(", ") : "None Known"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase" style={{ color: "var(--ink-soft)" }}>Active Medications</p>
                          <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>{card.medications.length ? card.medications.join(", ") : "None Known"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase" style={{ color: "var(--urgent)" }}>Allergies</p>
                          <p className="text-sm font-bold" style={{ color: "var(--urgent)" }}>{card.allergies.length ? card.allergies.join(", ") : "None Known"}</p>
                        </div>
                        {card.flags.length > 0 && (
                          <div>
                            <p className="text-xs font-bold uppercase" style={{ color: "var(--urgent)" }}>System Flags</p>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {card.flags.map(f => (
                                <span key={f} className="text-[10px] font-bold uppercase px-2 py-1 rounded" style={{ background: "var(--urgent-bg)", color: "var(--urgent)" }}>
                                  {f}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--ink-soft)" }}>Emergency Contacts</h3>
                      <div className="flex flex-col gap-4">
                        <div className="p-4 rounded-xl" style={{ background: "var(--surface-sunk)" }}>
                          <p className="text-xs font-bold uppercase" style={{ color: "var(--ink-soft)" }}>Primary Caregiver</p>
                          <p className="text-sm font-bold mt-1" style={{ color: "var(--ink)" }}>{card.caregiver || "Not Specified"}</p>
                        </div>
                        <button className="flex items-center justify-center gap-2 w-full py-4 rounded-xl text-sm font-bold transition-colors shadow-sm hover:opacity-80" style={{ background: "var(--ink)", color: "white" }}>
                          Notify Caregiver Automatically
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 flex flex-col items-center justify-center text-center">
                    <Activity size={24} style={{ color: "var(--ink-faint)" }} className="mb-2 animate-pulse" />
                    <p className="text-xs italic" style={{ color: "var(--ink-soft)" }}>Loading critical information...</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
