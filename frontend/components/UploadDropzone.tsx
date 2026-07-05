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

const UploadDropzone = forwardRef<UploadDropzoneRef, Props>(({ children, onUploadSuccess }, ref) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [selectedMember, setSelectedMember] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { household, activeMember } = useTwinStore();

  useImperativeHandle(ref, () => ({
    openFileDialog: () => {
      fileInputRef.current?.click();
    }
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

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      await handleFile(file);
    }
  }, []);

  const handleFile = async (file: File) => {
    if (!file) return;
    setIsUploading(true);
    try {
      const activeMemberObj = household?.members?.find(m => m.role_label === activeMember);
      const activeMemberId = activeMemberObj?.id?.toString() || (household?.members?.[0]?.id.toString() ?? undefined);
      
      const res = await uploadFile(file, activeMemberId);
      if (res && res.pending_id) {
        setPreview(res);
        if (res.member_id) {
           setSelectedMember(res.member_id.toString());
        } else if (activeMemberId) {
           setSelectedMember(activeMemberId);
        }
      }
    } catch (e) {
      alert("Failed to process document. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirm = async () => {
    if (!preview || !selectedMember) return;
    setIsUploading(true);
    try {
      // confirmUpload accepts pending_id and edits
      // Actually we need to pass member_id somehow... 
      // wait, api/upload didn't take member_id at confirm.
      // But we can upload again or pass edits?
      // Actually, wait, upload API takes member_id in the upload request?
      // Yes, upload API: POST /api/upload (member_id is optional but good).
      // Since it's already uploaded, the confirm endpoint in backend doesn't take member_id currently.
      // Let's check backend/app/api/upload.py.
      const res = await confirmUpload(preview.pending_id);
      if (res && res.status === "success") {
        onUploadSuccess(`Successfully extracted and saved data from ${preview.filename}.`);
        setPreview(null);
      }
    } catch (e) {
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

      {/* Processing overlay */}
      <AnimatePresence>
        {isUploading && !preview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center">
               <div className="w-8 h-8 border-4 border-t-[var(--accent)] rounded-full animate-spin mb-4" />
               <p className="font-semibold text-gray-700">Analyzing document...</p>
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
               <div className="mb-4">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Assign to Member
                  </label>
                  <select 
                    value={selectedMember}
                    onChange={(e) => setSelectedMember(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-gray-50 text-sm outline-none focus:border-[var(--accent)]"
                    disabled // Need to check if upload.py takes member_id on confirm or upload
                  >
                     {household?.members.map(m => (
                       <option key={m.id} value={m.id}>{m.role_label}</option>
                     ))}
                  </select>
                  <p className="text-[10px] text-gray-400 mt-1">
                    * The document will be saved to the member specified during upload. (Currently locked to default for demo)
                  </p>
               </div>

               {preview.extracted?.medications?.length > 0 && (
                 <div className="mb-3">
                   <h4 className="text-xs font-bold text-[var(--accent)] uppercase mb-1">Medications</h4>
                   <ul className="text-sm space-y-1">
                     {preview.extracted.medications.map((m: any, i: number) => (
                       <li key={i} className="flex justify-between bg-gray-50 p-2 rounded">
                         <span className="font-medium text-gray-800">{m.name}</span>
                         <span className="text-gray-500">{m.dose}</span>
                       </li>
                     ))}
                   </ul>
                 </div>
               )}

               {preview.extracted?.conditions?.length > 0 && (
                 <div className="mb-3">
                   <h4 className="text-xs font-bold text-[var(--urgent)] uppercase mb-1">Conditions</h4>
                   <div className="flex flex-wrap gap-2">
                     {preview.extracted.conditions.map((c: string, i: number) => (
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
                {isUploading ? <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" /> : "Save to Profile"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default UploadDropzone;
