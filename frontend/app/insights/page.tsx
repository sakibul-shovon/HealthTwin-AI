"use client";

import { useEffect, useState } from "react";
import { getInsights } from "@/lib/api";
import { InsightItem, RiskBand } from "@/lib/types";
import InsightFeed from "@/components/InsightFeed";

const RadarIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
     <circle cx="12" cy="12" r="10"></circle>
     <circle cx="12" cy="12" r="6"></circle>
     <circle cx="12" cy="12" r="2"></circle>
     <line x1="12" y1="2" x2="12" y2="12"></line>
  </svg>
);

export default function InsightsPage() {
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

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-6 gap-6 bg-slate-50">
      <div className="z-10 shrink-0">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <RadarIcon />
          Analytics & Pattern Radar
        </h1>
        <p className="text-slate-500 mt-1">Cross-household intelligence and active risk detection.</p>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-6 z-10 overflow-hidden">
        {/* Left: Active Risk Bands */}
        <div className="flex-1 bg-white rounded-2xl p-6 flex flex-col gap-4 border border-slate-200 shadow-sm">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Household Risk Bands</h2>
          <div className="flex flex-col gap-3 overflow-y-auto custom-scrollbar pr-2">
            {Object.entries(riskBands).map(([member, band]) => (
              <div key={member} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100">
                 <span className="font-semibold text-slate-800">{member}</span>
                 <span className={`px-3 py-1 rounded-md text-xs font-bold tracking-wider ${
                   band === 'HIGH' ? "bg-red-100 text-red-700" :
                   band === 'MED' ? "bg-amber-100 text-amber-700" :
                   "bg-emerald-100 text-emerald-700"
                 }`}>
                   {band} RISK
                 </span>
              </div>
            ))}
            {Object.keys(riskBands).length === 0 && (
              <div className="text-slate-400 italic p-4 text-center text-sm">No risk data available.</div>
            )}
          </div>
        </div>

        {/* Right: Insight Feed */}
        <div className="flex-[2] bg-white rounded-2xl p-6 flex flex-col border border-slate-200 shadow-sm">
           <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Detected Patterns</h2>
           <div className="flex-1 overflow-y-auto custom-scrollbar">
             <InsightFeed insights={insights} onQuery={() => {}} />
           </div>
        </div>
      </div>
    </div>
  );
}
