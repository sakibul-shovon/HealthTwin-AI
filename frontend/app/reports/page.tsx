"use client";

import { useState } from "react";
import PageHeader from "@/components/shell/PageHeader";
import { generateReport } from "@/lib/api";
import { ReportData } from "@/lib/types";
import { useTwinStore } from "@/lib/store";
import ReportView from "@/components/ReportView";
import { FileText, Download, Activity, Heart, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const REPORT_TYPES = [
  { type: "family_summary",   label: "Family Health Summary",  icon: <Heart size={20}/>, description: "Overview of everyone's active conditions and risks." },
  { type: "medication_report", label: "Medication List",       icon: <FileText size={20}/>, description: "Comprehensive list of all active medications." },
  { type: "disease_history",  label: "Disease History",   icon: <Activity size={20}/>, description: "Detailed medical history timeline." },
  { type: "monthly",          label: "Monthly Activity",    icon: <Calendar size={20}/>, description: "Summary of health events over the last 30 days." },
];

export default function ReportsPage() {
  const { household } = useTwinStore();
  const members = household?.members || [];
  
  const [activeReport, setActiveReport] = useState<ReportData | null>(null);
  const [reportLoading, setReportLoading] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<number | null>(null);

  const handleGenerate = async (type: string) => {
    setReportLoading(type);
    const data = await generateReport(type, selectedMember);
    if (data) setActiveReport(data as ReportData);
    setReportLoading(null);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden pb-10 relative">
      <PageHeader
        title="Reports"
        subtitle="Generate, view, and share comprehensive health reports"
      />

      <div className="flex-1 px-6 py-6 overflow-y-auto custom-scrollbar">
        <div className="max-w-4xl mx-auto flex flex-col gap-8">
          
          {/* Member Selection */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: "var(--ink-soft)" }}>Select Focus (Optional)</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedMember(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-sm"
                style={{
                  background: selectedMember === null ? "var(--primary-tint)" : "var(--surface)",
                  color: selectedMember === null ? "var(--primary)" : "var(--ink-soft)",
                  border: `1px solid ${selectedMember === null ? "var(--primary)" : "var(--border)"}`
                }}
              >
                Entire Family
              </button>
              {members.map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMember(m.id)}
                  className="px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-sm"
                  style={{
                    background: selectedMember === m.id ? "var(--primary-tint)" : "var(--surface)",
                    color: selectedMember === m.id ? "var(--primary)" : "var(--ink-soft)",
                    border: `1px solid ${selectedMember === m.id ? "var(--primary)" : "var(--border)"}`
                  }}
                >
                  {m.role_label}
                </button>
              ))}
            </div>
          </div>

          {/* Report Types */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: "var(--ink-soft)" }}>Available Reports</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {REPORT_TYPES.map(report => (
                <div key={report.type} className="glass-card p-5 flex flex-col gap-3 group hover:shadow-lg transition-shadow">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center mb-1" style={{ background: "var(--surface-sunk)", color: "var(--primary)" }}>
                    {report.icon}
                  </div>
                  <h4 className="text-sm font-bold" style={{ color: "var(--ink)" }}>{report.label}</h4>
                  <p className="text-xs flex-1" style={{ color: "var(--ink-soft)" }}>{report.description}</p>
                  <button
                    onClick={() => handleGenerate(report.type)}
                    disabled={reportLoading !== null}
                    className="flex items-center gap-2 text-xs font-bold px-4 py-2 mt-2 rounded-lg transition-colors justify-center hover:opacity-80 disabled:opacity-50"
                    style={{ background: "var(--primary)", color: "white" }}
                  >
                    {reportLoading === report.type ? (
                      <span className="animate-pulse">Generating...</span>
                    ) : (
                      <>
                        <FileText size={14} /> Generate Report
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
          
        </div>
      </div>

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
