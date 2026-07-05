"use client";
import { useState, useCallback, useRef, forwardRef, useImperativeHandle } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [selectedMember, setSelectedMember] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { household, activeMember } = useTwinStore();

  useImperativeHandle(ref, () => ({
    openFileDialog: () => {
      fileInputRef.current?.click();
    },
  }));

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (!file) return;
    setIsUploading(true);
    try {
      const activeMemberObj = household?.members?.find((m) => m.role_label === activeMember);
      const activeMemberId = activeMemberObj?.id?.toString() ?? household?.members?.[0]?.id.toString();
      const res = await uploadFile(file, activeMemberId) as UploadPreview | null;
      if (res?.pending_id) {
        setPreview(res);
        setSelectedMember(
          res.member_id?.toString() ?? activeMemberId ?? ""
        );
      }
    } catch {
      alert("Failed to process document. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }, [household, activeMember]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFile(e.dataTransfer.files[0]);
    }
  }, [handleFile]);

  const handleConfirm = async () => {
    if (!preview || !selectedMember) return;
    setIsUploading(true);
    try {
      const res = await confirmUpload(preview.pending_id) as { status: string } | null;
      if (res?.status === "success") {
        const meds = preview.extracted?.medications?.length ?? 0;
        const conds = preview.extracted?.conditions?.length ?? 0;
        const labs = preview.extracted?.lab_values?.length ?? 0;
        let summary = `Document saved: ${preview.filename}`;
        if (meds > 0 || conds > 0 || labs > 0) {
          const parts = [];
          if (meds > 0) parts.push(`${meds} medication${meds > 1 ? "s" : ""}`);
          if (conds > 0) parts.push(`${conds} condition${conds > 1 ? "s" : ""}`);
          if (labs > 0) parts.push(`${labs} lab value${labs > 1 ? "s" : ""}`);
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
        accept="image/*,application/pdf"
      />
      {children}

      {/* Full screen drag overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center rounded-xl m-2"
            style={{ backgroundColor: "rgba(15,76,85,0.30)", border: "2px dashed var(--accent)" }}
          >
            <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center">
              <span className="text-4xl mb-2">📄</span>
              <p className="font-bold text-gray-800">Drop document here</p>
              <p className="text-sm text-gray-500">Prescription, lab report, or image</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Processing overlay — visual scanning animation */}
      <AnimatePresence>
        {isUploading && !preview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(245,241,233,0.88)", backdropFilter: "blur(8px)" }}
          >
            <div className="flex flex-col items-center gap-4 text-center px-8">
              {/* Scanning icon */}
              <div className="relative w-16 h-16">
                <div
                  className="absolute inset-0 rounded-2xl flex items-center justify-center"
                  style={{ background: "var(--surface)", border: "1.5px solid var(--border)", boxShadow: "var(--shadow-md)" }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                </div>
                {/* Orbit ring */}
                <motion.div
                  className="absolute inset-[-6px] rounded-[22px]"
                  style={{ border: "2px solid var(--accent)", opacity: 0.4 }}
                  animate={{ scale: [1, 1.12, 1], opacity: [0.4, 0.8, 0.4] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                />
              </div>

              <div>
                <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>
                  Reading prescription…
                </p>
                <p className="text-[11px] mt-1" style={{ color: "var(--ink-soft)" }}>
                  Extracting medications, doses &amp; conditions
                </p>
              </div>

              {/* Step indicators */}
              <div className="flex items-center gap-2">
                {["OCR", "Parse", "Match"].map((step, i) => (
                  <motion.div
                    key={step}
                    className="flex items-center gap-1.5"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.4 }}
                  >
                    <motion.div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: "var(--accent)" }}
                      animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.3 }}
                    />
                    <span className="text-[10px] font-medium" style={{ color: "var(--ink-faint)" }}>{step}</span>
                    {i < 2 && <span style={{ color: "var(--border-bright)", fontSize: 10 }}>→</span>}
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview Card */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute bottom-4 left-4 right-4 z-50 bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100"
          >
            <div className="p-4 bg-[var(--primary)] text-white flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2">
                <span>📄</span> Extracted Data
              </h3>
              <span className="text-xs opacity-80">{preview.filename}</span>
            </div>

            <div className="p-4 max-h-[50vh] overflow-y-auto">
              {/* Non-medical warning */}
              {preview.is_medical === false && (
                <div className="mb-4 flex items-start gap-2 px-3 py-2.5 rounded-xl text-sm"
                  style={{ background: "var(--watch-bg)", border: "1px solid var(--watch)", color: "var(--watch)" }}>
                  <span className="shrink-0 mt-0.5">⚠</span>
                  <div>
                    <p className="font-semibold text-[13px]">No medical data found</p>
                    <p className="text-[11px] mt-0.5 opacity-80">
                      This document does not appear to be a prescription or lab report.
                      The file will be saved but nothing will be added to the health profile.
                    </p>
                  </div>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Assign to Member
                </label>
                <select
                  value={selectedMember}
                  onChange={(e) => setSelectedMember(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-gray-50 text-sm outline-none focus:border-[var(--accent)]"
                  disabled
                >
                  {household?.members.map((m) => (
                    <option key={m.id} value={m.id}>{m.role_label}</option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-400 mt-1">
                  * Locked to member specified at upload for this demo.
                </p>
              </div>

              {(preview.extracted?.medications?.length ?? 0) > 0 && (
                <div className="mb-3">
                  <h4 className="text-xs font-bold text-[var(--accent)] uppercase mb-1">Medications</h4>
                  <ul className="text-sm space-y-1">
                    {preview.extracted!.medications!.map((med, i) => (
                      <li key={i} className="flex justify-between bg-gray-50 p-2 rounded">
                        <span className="font-medium text-gray-800">{med.name}</span>
                        <span className="text-gray-500">{med.dose}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(preview.extracted?.conditions?.length ?? 0) > 0 && (
                <div className="mb-3">
                  <h4 className="text-xs font-bold text-[var(--urgent)] uppercase mb-1">Conditions</h4>
                  <div className="flex flex-wrap gap-2">
                    {preview.extracted!.conditions!.map((c, i) => (
                      <span key={i} className="bg-red-50 text-[var(--urgent)] text-xs px-2 py-1 rounded-full font-medium">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 flex justify-end gap-3 border-t">
              <button
                onClick={() => setPreview(null)}
                className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-800 transition-colors"
                disabled={isUploading}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="px-5 py-2 text-sm font-bold text-white rounded-xl shadow transition-transform active:scale-95 flex items-center gap-2"
                style={{ backgroundColor: "var(--primary)" }}
                disabled={isUploading}
              >
                {isUploading
                  ? <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" />
                  : preview?.is_medical === false ? "Save Document Only" : "Save to Profile"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

UploadDropzone.displayName = "UploadDropzone";

export default UploadDropzone;
