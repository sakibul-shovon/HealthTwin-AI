"use client";

import { useRef, useState, useEffect } from "react";
import PageHeader from "@/components/shell/PageHeader";
import UploadDropzone, { UploadDropzoneRef } from "@/components/UploadDropzone";
import { getMemberTimeline } from "@/lib/api";
import { useTwinStore } from "@/lib/store";
import { Activity, FileText } from "lucide-react";

export default function RecordsPage() {
  const dropzoneRef = useRef<UploadDropzoneRef>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const { household } = useTwinStore();
  const members = household?.members || [];
  const [uploads, setUploads] = useState<any[]>([]);

  useEffect(() => {
    const fetchUploads = async () => {
      const allEvents = await Promise.all(members.map(m => getMemberTimeline(m.id)));
      const uploadEvents = allEvents.flat().filter(e => e.event_type === "document_uploaded" || e.detail?.filename);
      uploadEvents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setUploads(uploadEvents);
    };
    if (members.length > 0) fetchUploads();
  }, [household, members]);

  return (
    <div className="flex flex-col h-full overflow-hidden pb-10">
      <PageHeader
        title="Records"
        subtitle="Upload prescriptions, labs, and medical documents"
        onScan={() => dropzoneRef.current?.openFileDialog()}
        action={
          <button
            onClick={() => dropzoneRef.current?.openFileDialog()}
            className="text-sm font-semibold px-4 py-2 rounded-xl transition-all"
            style={{
              background: "linear-gradient(135deg, var(--primary), var(--primary-deep))",
              color: "#fff",
              boxShadow: "var(--shadow-md)",
            }}
          >
            Upload Document
          </button>
        }
      />

      <div className="flex-1 px-6 py-6 overflow-y-auto custom-scrollbar">
        <UploadDropzone ref={dropzoneRef} onUploadSuccess={(msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(""), 5000); }}>
          <div className="flex flex-col lg:flex-row gap-6 h-full min-h-[400px]">
            {/* Upload Area */}
            <div 
              className="flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-8 text-center transition-colors hover:bg-gray-50/50 cursor-pointer"
              style={{ borderColor: "var(--primary-tint)", background: "var(--surface)" }}
              onClick={() => dropzoneRef.current?.openFileDialog()}
            >
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: "var(--primary-tint)", color: "var(--primary)" }}>
                <FileText size={32} />
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: "var(--ink)" }}>Upload or Drag a Document</h3>
              <p className="text-sm max-w-sm" style={{ color: "var(--ink-soft)" }}>
                Drop a prescription, lab report, or any medical image here to automatically extract and save the records.
              </p>
            </div>

            {/* Recent Uploads */}
            <div className="lg:w-[400px] shrink-0 flex flex-col gap-4">
              <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Recent Uploads</h3>
              {successMsg && (
                <div className="p-3 rounded-lg text-xs font-bold mb-2 shadow-sm" style={{ background: "var(--well-bg)", color: "var(--well)" }}>
                  ✓ {successMsg}
                </div>
              )}
              {uploads.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {uploads.map((u, i) => (
                    <div key={i} className="glass-card p-4 flex gap-3 items-start">
                      <div className="p-2 rounded-lg shrink-0" style={{ background: "var(--surface-sunk)", color: "var(--ink-faint)" }}>
                        <FileText size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate" style={{ color: "var(--ink)" }}>{u.detail?.filename || "Document"}</p>
                        <p className="text-[10px] font-bold tracking-wider uppercase mt-1" style={{ color: "var(--ink-soft)" }}>
                          {new Date(u.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="glass-card p-6 flex flex-col items-center text-center justify-center flex-1 min-h-[200px]">
                  <Activity size={24} style={{ color: "var(--ink-faint)" }} className="mb-2" />
                  <p className="text-xs italic" style={{ color: "var(--ink-soft)" }}>No recent document activity found.</p>
                </div>
              )}
            </div>
          </div>
        </UploadDropzone>
      </div>
    </div>
  );
}
