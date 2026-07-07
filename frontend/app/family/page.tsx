"use client";

import { useState } from "react";
import PageHeader from "@/components/shell/PageHeader";
import { useTwinStore } from "@/lib/store";
import FamilyManager from "@/components/FamilyManager";
import Constellation from "@/components/Constellation";
import Link from "next/link";
import { Plus } from "lucide-react";

export default function FamilyPage() {
  const { household } = useTwinStore();
  const members = household?.members ?? [];
  const [isManagerOpen, setManagerOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const handleOpenManager = (id?: number) => {
    setEditingId(id || null);
    setManagerOpen(true);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden pb-10">
      <FamilyManager
        isOpen={isManagerOpen}
        onClose={() => setManagerOpen(false)}
        initialMemberId={editingId}
      />

      <PageHeader
        title="Family"
        subtitle="Members, records, and caregiver relationships"
        action={
          <button
            onClick={() => handleOpenManager()}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-all"
            style={{
              background: "linear-gradient(135deg, var(--primary), var(--primary-deep))",
              color: "#fff",
              boxShadow: "var(--shadow-md)",
            }}
          >
            <Plus size={16} /> Add Member
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col xl:flex-row gap-6 custom-scrollbar">
        {/* Roster Column */}
        <div className="flex-1 flex flex-col gap-4">
          <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Household Roster</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {members.map(m => (
              <div key={m.id} className="glass-card p-5 flex flex-col gap-4 group hover:shadow-lg transition-shadow relative">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-lg" style={{ background: "var(--primary-deep)" }}>
                      {m.display_name?.[0] || m.role_label[0]}
                    </div>
                    <div>
                      <p className="text-base font-bold" style={{ color: "var(--ink)" }}>{m.role_label}</p>
                      <p className="text-xs font-medium" style={{ color: "var(--ink-soft)" }}>{m.display_name} • {m.age} yrs • {m.sex}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleOpenManager(m.id)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg opacity-100 xl:opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    style={{ background: "var(--surface-sunk)", color: "var(--ink-soft)" }}
                  >
                    Edit
                  </button>
                </div>
                
                <div className="flex flex-wrap gap-2 text-[10px] uppercase font-bold tracking-wider" style={{ color: "var(--ink-faint)" }}>
                  <span className="px-2.5 py-1 rounded-md" style={{ background: "var(--surface-sunk)" }}>{m.medications?.length || 0} Meds</span>
                  <span className="px-2.5 py-1 rounded-md" style={{ background: "var(--surface-sunk)" }}>{m.conditions?.length || 0} Cond</span>
                  <span className="px-2.5 py-1 rounded-md" style={{ background: "var(--surface-sunk)" }}>{m.allergies?.length || 0} Allergies</span>
                </div>
                
                <Link href={`/family/${m.id}`} className="mt-2 text-sm font-bold text-center py-2 rounded-xl border transition-colors relative z-0" style={{ borderColor: "var(--border)", color: "var(--primary)", background: "var(--surface)" }}>
                  View Member Twin
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Graph Column */}
        <div className="xl:w-96 shrink-0 flex flex-col gap-4">
          <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Family Graph</h3>
          <div className="glass-card p-4 aspect-square flex items-center justify-center relative overflow-hidden" style={{ minHeight: "350px" }}>
             {/* Background dots */}
             <div className="absolute inset-0 dot-grid pointer-events-none opacity-50" />
             {members.length > 0 ? (
               <Constellation
                 members={members}
                 focusedMember={null}
                 activeMember={null}
                 onSelect={(role) => {
                    const m = members.find(m => m.role_label === role);
                    if (m) {
                       window.location.href = `/family/${m.id}`;
                    }
                 }}
               />
             ) : (
               <p className="text-xs" style={{ color: "var(--ink-soft)" }}>No members found.</p>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
