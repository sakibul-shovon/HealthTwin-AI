"use client";
import { useState, useCallback, useRef, forwardRef, useImperativeHandle } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, CheckCircle, AlertTriangle } from "lucide-react";
import { uploadFile, confirmUpload } from "@/lib/api";
import { useTwinStore } from "@/lib/store";

interface Props {
  children: React.ReactNode;
  onUploadSuccess: (summary: string) => void;
}

export interface UploadDropzoneRef {
  openFileDialog: () => void;
}

interface ExtractedMedication {
  name: string;
  dose: string;
}

interface UploadPreview {
  pending_id: string;
  filename: string;
  member_id?: number;
  is_medical?: boolean;
  extracted?: {
    medications?: ExtractedMedication[];
    conditions?: string[];
    lab_values?: { test: string; value: string; unit: string }[];
  };
}

const UploadDropzone = forwardRef<UploadDropzoneRef, Props>(({ children, onUploadSuccess }, ref) => {
  const [isDragging, setIsDragging]   = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview]         = useState<UploadPreview | null>(null);
  const [selectedMember, setSelectedMember] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { household, activeMember } = useTwinStore();

  useImperativeHandle(ref, () => ({
    openFileDialog: () => fileInputRef.current?.click(),
  }));

  const handleDrag    = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); }, []);
  const handleDragIn  = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.items?.length) setIsDragging(true); }, []);
  const handleDragOut = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }, []);

  const handleFile = useCallback(async (file: File) => {
    if (!file) return;
    setIsUploading(true);
    try {
      const activeMemberObj = household?.members?.find((m) => m.role_label === activeMember);
      const activeMemberId  = activeMemberObj?.id?.toString() ?? household?.members?.[0]?.id.toString();
      const res = await uploadFile(file, activeMemberId) as UploadPreview | null;
      if (res?.pending_id) {
        setPreview(res);
        setSelectedMember(res.member_id?.toString() ?? activeMemberId ?? "");
      }
    } catch (err: any) {
      alert(err?.message || "Failed to process document. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }, [household, activeMember]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    if (e.dataTransfer.files?.length) await handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const handleConfirm = async () => {
    if (!preview || !selectedMember) return;
    setIsUploading(true);
    try {
      const res = await confirmUpload(preview.pending_id, undefined, parseInt(selectedMember)) as { status: string } | null;
      if (res?.status === "success" || res?.status === "already_exists") {
        const meds  = preview.extracted?.medications?.length ?? 0;
        const conds = preview.extracted?.conditions?.length ?? 0;
        const labs  = preview.extracted?.lab_values?.length ?? 0;
        let summary = `Document saved: ${preview.filename}`;
        if (meds > 0 || conds > 0 || labs > 0) {
          const parts = [];
          if (meds  > 0) parts.push(`${meds} medication${meds > 1 ? "s" : ""}`);
          if (conds > 0) parts.push(`${conds} condition${conds > 1 ? "s" : ""}`);
          if (labs  > 0) parts.push(`${labs} lab value${labs > 1 ? "s" : ""}`);
          summary = `Added ${parts.join(", ")} from ${preview.filename}.`;
        } else {
          summary = `Document saved (no medical data found in ${preview.filename}).`;
        }
        onUploadSuccess(summary);
        setPreview(null);
      }
    } catch {
      alert("Failed to confirm upload.");
    } finally {
      setIsUploading(false);
    }
  };

  const medCount  = preview?.extracted?.medications?.length ?? 0;
  const condCount = preview?.extracted?.conditions?.length ?? 0;
  const labCount  = preview?.extracted?.lab_values?.length ?? 0;

  return (
    <div
      className="relative flex-1 flex flex-col h-full"
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => e.target.files && handleFile(e.target.files[0])}
        className="hidden"
        accept="image/jpeg,image/jpg,image/png,application/pdf"
      />
      {children}

      {/* Drag overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center rounded-xl m-2"
            style={{ backgroundColor: "rgba(15,76,85,0.25)", border: "2px dashed var(--accent)" }}
          >
            <div className="bg-white px-8 py-6 rounded-2xl shadow-xl flex flex-col items-center gap-2">
              <FileText size={32} style={{ color: "var(--primary)" }} />
              <p className="font-bold" style={{ color: "var(--ink)" }}>Drop to scan</p>
              <p className="text-xs" style={{ color: "var(--ink-soft)" }}>Prescription, lab report, or image</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scanning animation */}
      <AnimatePresence>
        {isUploading && !preview && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(245,241,233,0.90)", backdropFilter: "blur(8px)" }}
          >
            <div className="flex flex-col items-center gap-5 text-center px-8">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-2xl flex items-center justify-center"
                  style={{ background: "var(--surface)", border: "1.5px solid var(--border)", boxShadow: "var(--shadow-md)" }}>
                  <FileText size={26} style={{ color: "var(--accent)" }} />
                </div>
                <motion.div className="absolute inset-[-6px] rounded-[22px]"
                  style={{ border: "2px solid var(--accent)", opacity: 0.4 }}
                  animate={{ scale: [1, 1.14, 1], opacity: [0.4, 0.9, 0.4] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>Reading document…</p>
                <p className="text-[11px] mt-1" style={{ color: "var(--ink-soft)" }}>
                  Extracting medications, doses &amp; conditions
                </p>
              </div>
              <div className="flex items-center gap-2">
                {["OCR", "Parse", "Match"].map((step, i) => (
                  <motion.div key={step} className="flex items-center gap-1.5"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.4 }}>
                    <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)" }}
                      animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.3 }} />
                    <span className="text-[10px] font-medium" style={{ color: "var(--ink-faint)" }}>{step}</span>
                    {i < 2 && <span style={{ color: "var(--border-bright)", fontSize: 10 }}>→</span>}
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Extracted data modal */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1,    opacity: 1, y: 0  }}
              exit=   {{ scale: 0.95, opacity: 0, y: 12 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              {/* Header */}
              <div className="px-5 py-4 flex items-center justify-between"
                style={{ background: "var(--primary)" }}>
                <div className="flex items-center gap-2.5">
                  <FileText size={16} color="#fff" />
                  <span className="font-bold text-white text-sm">Extracted Data</span>
                </div>
                <span className="text-[11px] text-white/60 font-mono truncate max-w-[160px]">
                  {preview.filename}
                </span>
              </div>

              {/* Body */}
              <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">

                {/* Non-medical warning */}
                {preview.is_medical === false && (
                  <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl"
                    style={{ background: "var(--watch-bg)", color: "var(--watch)" }}>
                    <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[13px] font-semibold">No medical data found</p>
                      <p className="text-[11px] mt-0.5 opacity-80">
                        File will be saved but nothing is added to the health profile.
                      </p>
                    </div>
                  </div>
                )}

                {/* Member selector */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                    style={{ color: "var(--ink-soft)" }}>
                    Assign to Member
                  </label>
                  <select
                    value={selectedMember}
                    onChange={(e) => setSelectedMember(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm font-medium outline-none transition-all cursor-pointer"
                    style={{
                      background: "var(--surface-sunk)",
                      border: "1.5px solid var(--border)",
                      color: "var(--ink)",
                    }}
                  >
                    {household?.members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.display_name ?? m.role_label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Medications */}
                {medCount > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2"
                      style={{ color: "var(--accent)" }}>
                      Medications · {medCount}
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {preview.extracted!.medications!.map((med, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                          style={{ background: "var(--surface-sunk)" }}>
                          <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                            {med.name}
                          </span>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg"
                            style={{ background: "var(--primary-tint)", color: "var(--primary)" }}>
                            {med.dose}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Conditions */}
                {condCount > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2"
                      style={{ color: "var(--urgent)" }}>
                      Conditions · {condCount}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {preview.extracted!.conditions!.map((c, i) => (
                        <span key={i} className="px-3 py-1.5 rounded-full text-[11px] font-semibold"
                          style={{ background: "var(--urgent-bg)", color: "var(--urgent)" }}>
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lab values */}
                {labCount > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2"
                      style={{ color: "var(--primary)" }}>
                      Lab Values · {labCount}
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {preview.extracted!.lab_values!.map((lv, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                          style={{ background: "var(--surface-sunk)" }}>
                          <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{lv.test}</span>
                          <span className="text-[11px] font-bold" style={{ color: "var(--ink-soft)" }}>
                            {lv.value} {lv.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-4 flex items-center justify-end gap-3"
                style={{ borderTop: "1px solid var(--border)", background: "var(--surface-sunk)" }}>
                <button
                  onClick={() => setPreview(null)}
                  disabled={isUploading}
                  className="px-4 py-2 text-sm font-semibold rounded-xl transition-all hover:opacity-70 disabled:opacity-40"
                  style={{ color: "var(--ink-soft)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isUploading || !selectedMember}
                  className="px-5 py-2.5 text-sm font-bold text-white rounded-xl flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                  style={{
                    background: "linear-gradient(135deg, var(--primary), var(--primary-deep))",
                    boxShadow: "var(--shadow-md)",
                  }}
                >
                  {isUploading
                    ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    : <><CheckCircle size={15} /> {preview?.is_medical === false ? "Save Document" : "Save to Profile"}</>
                  }
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

UploadDropzone.displayName = "UploadDropzone";
export default UploadDropzone;
