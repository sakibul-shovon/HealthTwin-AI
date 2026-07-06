"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/shell/PageHeader";
import { useTwinStore } from "@/lib/store";
import { getHousehold, getBriefing, getInsights, getChatHistory } from "@/lib/api";
import { InsightItem, RiskBand } from "@/lib/types";
import { ShieldAlert, Info, ShieldCheck, Activity, Users, Plus, FileText } from "lucide-react";
import Link from "next/link";
import { useHealthTwinCommand } from "@/hooks/useHealthTwinCommand";

export default function OverviewPage() {
  const { household, setHousehold, setMessages } = useTwinStore();
  const [briefing, setBriefing] = useState<any>(null);
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [riskBands, setRiskBands] = useState<Record<string, RiskBand>>({});
  const [activity, setActivity] = useState<any[]>([]);
  
  const { handleCommand } = useHealthTwinCommand();

  useEffect(() => {
    const init = async () => {
      const [data, brief, insightData, history] = await Promise.all([
        getHousehold(),
        getBriefing(),
        getInsights(),
        getChatHistory(10),
      ]);
      if (data) setHousehold(data);
      if (brief) setBriefing(brief);
      if (insightData) {
        setInsights(insightData.insights ?? []);
        setRiskBands(insightData.risk_bands ?? {});
      }
      if (history) {
        setActivity(history.slice(0, 10));
      }
    };
    init();
  }, [setHousehold]);

  const members = household?.members ?? [];

  return (
    <div className="flex flex-col min-h-full pb-10">
      <PageHeader
        title="Today"
        subtitle={household ? `${household.name} health briefing` : "Family health briefing"}
      />
      
      <div className="px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Briefing */}
          {briefing && (
            <div className="glass-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase" style={{ background: "var(--well-bg)", color: "var(--well)" }}>
                  {briefing.verdict || "SAFE"}
                </span>
                <span className="text-xs font-semibold" style={{ color: "var(--ink)" }}>Daily Briefing</span>
              </div>
              <p className="text-sm font-medium leading-relaxed" style={{ color: "var(--ink)" }}>{briefing.spoken}</p>
            </div>
          )}

          {/* Family Status Board */}
          <div>
            <h3 className="text-sm font-bold mb-3 uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Family Members</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {members.map(m => (
                <Link key={m.id} href={`/family/${m.id}`} className="glass-card p-4 hover:opacity-80 transition-opacity">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white" style={{ background: "var(--primary-deep)" }}>
                        {m.display_name?.[0] || m.role_label[0]}
                      </div>
                      <div>
                        <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>{m.display_name || m.role_label}</p>
                        <p className="text-xs" style={{ color: "var(--ink-soft)" }}>{m.role_label} • {m.age} • {m.sex}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 text-[10px] uppercase font-bold tracking-wider mt-4" style={{ color: "var(--ink-faint)" }}>
                    <span className="px-2 py-1 rounded-md" style={{ background: "var(--surface-sunk)" }}>{m.medications?.length || 0} Meds</span>
                    <span className="px-2 py-1 rounded-md" style={{ background: "var(--surface-sunk)" }}>{m.conditions?.length || 0} Cond</span>
                  </div>
                </Link>
              ))}
              <Link href="/family" className="p-4 rounded-xl flex flex-col items-center justify-center gap-2 hover:opacity-80 transition-opacity border-2 border-dashed" style={{ borderColor: "var(--primary-tint)" }}>
                <Plus size={20} style={{ color: "var(--primary)" }} />
                <span className="text-xs font-bold" style={{ color: "var(--primary)" }}>Manage Family</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Quick Actions */}
          <div>
            <h3 className="text-sm font-bold mb-3 uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/ask" className="glass-card p-4 flex flex-col gap-2 items-center text-center hover:opacity-80 transition-opacity">
                <ShieldCheck size={20} style={{ color: "var(--primary)" }} />
                <span className="text-xs font-bold" style={{ color: "var(--ink)" }}>Ask HealthTwin</span>
              </Link>
              <Link href="/records" className="glass-card p-4 flex flex-col gap-2 items-center text-center hover:opacity-80 transition-opacity">
                <Activity size={20} style={{ color: "var(--primary)" }} />
                <span className="text-xs font-bold" style={{ color: "var(--ink)" }}>Scan Document</span>
              </Link>
              <Link href="/reports" className="glass-card p-4 flex flex-col gap-2 items-center text-center hover:opacity-80 transition-opacity">
                <FileText size={20} style={{ color: "var(--primary)" }} />
                <span className="text-xs font-bold" style={{ color: "var(--ink)" }}>Generate Report</span>
              </Link>
              <Link href="/emergency" className="glass-card p-4 flex flex-col gap-2 items-center text-center hover:opacity-80 transition-opacity">
                <ShieldAlert size={20} style={{ color: "var(--urgent)" }} />
                <span className="text-xs font-bold" style={{ color: "var(--urgent)" }}>Emergency</span>
              </Link>
            </div>
          </div>

          {/* AI Insights */}
          {insights.length > 0 && (
            <div>
              <h3 className="text-sm font-bold mb-3 uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Needs Attention</h3>
              <div className="flex flex-col gap-3">
                {insights.slice(0, 4).map((insight, idx) => (
                  <div key={idx} className="glass-card p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${insight.severity === 'HIGH' ? 'animate-pulse' : ''}`} style={{ backgroundColor: insight.severity === 'HIGH' ? 'var(--urgent)' : insight.severity === 'MED' ? 'var(--watch)' : 'var(--info)' }} />
                      <p className="text-xs font-bold" style={{ color: "var(--ink)" }}>{insight.title}</p>
                    </div>
                    <p className="text-[11px]" style={{ color: "var(--ink-soft)" }}>{insight.detail}</p>
                    {insight.action_query && (
                      <button 
                        onClick={() => handleCommand(insight.action_query!, "en")}
                        className="text-[10px] font-bold self-start mt-1 px-2.5 py-1 rounded-md transition-opacity hover:opacity-80"
                        style={{ background: "var(--primary-tint)", color: "var(--primary)" }}
                      >
                        Ask: {insight.action_query}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
