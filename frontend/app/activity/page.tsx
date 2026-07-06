"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/shell/PageHeader";
import { useTwinStore } from "@/lib/store";
import { getChatHistory } from "@/lib/api";
import { Activity, ShieldCheck, User, MessageCircle, Info } from "lucide-react";

export default function ActivityPage() {
  const { household } = useTwinStore();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      const data = await getChatHistory(100);
      setHistory(data || []);
      setLoading(false);
    };
    fetchHistory();
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden pb-10">
      <PageHeader
        title="Activity Log"
        subtitle="Recent interactions and system events"
      />

      <div className="flex-1 px-6 py-6 overflow-y-auto custom-scrollbar">
        <div className="max-w-4xl mx-auto flex flex-col gap-6">
          
          <div className="glass-card p-6 min-h-[500px] flex flex-col">
            <h3 className="text-sm font-bold uppercase tracking-wide mb-6" style={{ color: "var(--ink-soft)" }}>Timeline</h3>
            
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                <Activity size={24} className="animate-pulse mb-2" style={{ color: "var(--ink-faint)" }} />
                <p className="text-xs font-medium" style={{ color: "var(--ink-soft)" }}>Loading activity log...</p>
              </div>
            ) : history.length > 0 ? (
              <div className="flex flex-col relative">
                <div className="absolute left-[15px] top-2 bottom-6 w-[2px] rounded-full" style={{ background: "var(--border)" }}></div>
                {history.map((item, i) => (
                  <div key={i} className="flex gap-4 relative pb-6 z-10">
                    <div className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-white font-bold shadow-sm mt-0.5" style={{ background: item.role === "user" ? "var(--ink)" : "var(--primary)" }}>
                      {item.role === "user" ? <User size={14} /> : <ShieldCheck size={14} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold uppercase" style={{ color: "var(--ink)" }}>{item.role === "user" ? "You" : "HealthTwin"}</span>
                        <span className="text-[10px] font-bold tracking-wider text-gray-400">
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(item.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      
                      <div className="p-3 rounded-xl text-sm" style={{ background: item.role === "user" ? "var(--surface-sunk)" : "var(--primary-tint)", color: item.role === "user" ? "var(--ink)" : "var(--primary)", border: `1px solid ${item.role === "user" ? "var(--border)" : "transparent"}` }}>
                        <p>{item.text}</p>
                      </div>

                      {item.envelope?.verdict && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-1 rounded uppercase" style={{ background: "var(--surface)", color: "var(--ink-soft)", border: "1px solid var(--border)" }}>
                            Verdict: {item.envelope.verdict}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center">
                <MessageCircle size={24} className="mb-2" style={{ color: "var(--ink-faint)" }} />
                <p className="text-xs font-medium" style={{ color: "var(--ink-soft)" }}>No activity recorded yet.</p>
              </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}
