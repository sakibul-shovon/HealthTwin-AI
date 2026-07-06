"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getInsights } from "@/lib/api";
import { useTwinStore } from "@/lib/store";
import { InsightItem, RiskBand } from "@/lib/types";
import Constellation from "@/components/Constellation";
import InsightFeed from "@/components/InsightFeed";

const BrainIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
    <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>
    <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>
    <path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/>
    <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/>
    <path d="M3.477 10.896a4 4 0 0 1 .585-.396"/>
    <path d="M19.938 10.5a4 4 0 0 1 .585.396"/>
    <path d="M6 18a4 4 0 0 1-1.967-.516"/>
    <path d="M19.967 17.484A4 4 0 0 1 18 18"/>
  </svg>
);

export default function CommandCenter() {
  const router = useRouter();
  const { household, activeMember, lastResponse, setActiveMember } = useTwinStore();
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [riskBands, setRiskBands] = useState<Record<string, RiskBand>>({});

  useEffect(() => {
    const fetchInsights = async () => {
      const insightData = await getInsights();
      if (insightData) {
        setInsights(insightData.insights ?? []);
        setRiskBands(insightData.risk_bands ?? {});
      }
    };
    fetchInsights();
  }, []);

  const members = household?.members ?? [];
  const focusedMember = lastResponse?.member_focus ?? null;
  const alertMembers = lastResponse?.display?.members ?? [];

  const handleMemberSelect = (roleLabel: string) => {
    setActiveMember(roleLabel);
    router.push("/twins");
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
      <div className="flex-1 flex flex-col md:flex-row p-6 gap-6 h-full">
        {/* Left: Main Constellation View */}
        <div className="flex-[2] bg-white rounded-2xl p-6 flex flex-col shadow-sm border border-slate-200 relative overflow-hidden">
          <div className="absolute top-6 left-6 z-20">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Family Constellation</h2>
            <p className="text-sm text-slate-500">Real-time health topology</p>
          </div>
          
          <div className="flex-1 w-full h-full relative flex items-center justify-center">
            {members.length > 0 ? (
              <Constellation
                hero
                members={members}
                focusedMember={focusedMember}
                activeMember={activeMember}
                alertMembers={alertMembers}
                verdict={lastResponse?.verdict ?? null}
                riskBands={riskBands}
                onSelect={handleMemberSelect}
                centerSlot={
                  <div className="flex flex-col items-center justify-center w-32 h-32 rounded-full bg-slate-50 border border-slate-200 shadow-sm">
                    <span className="text-sm font-bold text-slate-800">{household?.name ?? "Family"}</span>
                    <span className="text-xs text-blue-600 font-medium">{members.length} Members</span>
                  </div>
                }
              />
            ) : (
              <div className="flex flex-col items-center gap-4 animate-pulse">
                <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200" />
                <p className="text-slate-400 text-sm font-medium">Initializing connection...</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Quick Insights Feed */}
        <div className="flex-1 flex flex-col gap-6 h-full">
          <div className="flex-1 bg-white rounded-2xl overflow-hidden flex flex-col shadow-sm border border-slate-200">
            <div className="p-5 border-b border-slate-100 shrink-0 bg-slate-50/50">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <BrainIcon />
                Active Insights
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
              <InsightFeed
                insights={insights}
                onQuery={(q) => { console.log("Trigger query:", q); }}
              />
            </div>
          </div>

          <div className="h-1/3 bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col justify-center">
             <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">System Status</h4>
             <div className="flex flex-col gap-3">
               <div className="flex items-center justify-between">
                 <span className="text-sm font-medium text-slate-600">Deterministic Engine</span>
                 <span className="text-[10px] font-bold text-emerald-700 px-2.5 py-1 rounded-md bg-emerald-100">ACTIVE</span>
               </div>
               <div className="flex items-center justify-between">
                 <span className="text-sm font-medium text-slate-600">Pattern Radar</span>
                 <span className="text-[10px] font-bold text-blue-700 px-2.5 py-1 rounded-md bg-blue-100">SCANNING</span>
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
