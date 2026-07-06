"use client";

import { useRef } from "react";
import UploadDropzone, { UploadDropzoneRef } from "@/components/UploadDropzone";
import { useTwinStore } from "@/lib/store";

const DocumentIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
     <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
     <polyline points="14 2 14 8 20 8"></polyline>
     <line x1="16" y1="13" x2="8" y2="13"></line>
     <line x1="16" y1="17" x2="8" y2="17"></line>
     <polyline points="10 9 9 9 8 9"></polyline>
  </svg>
);

const UploadIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="17 8 12 3 7 8"></polyline>
    <line x1="12" y1="3" x2="12" y2="15"></line>
  </svg>
);

const InfoIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600 mt-0.5">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="16" x2="12" y2="12"></line>
    <line x1="12" y1="8" x2="12.01" y2="8"></line>
  </svg>
);

export default function RecordsPage() {
  const dropzoneRef = useRef<UploadDropzoneRef>(null);
  const { addMessage } = useTwinStore();

  const handleUploadSuccess = (summary: string) => {
    addMessage({
      id: `system-${Date.now()}`,
      role: "assistant",
      text: summary,
      timestamp: Date.now(),
      envelope: {
        verdict: "CONFIRMED",
        spoken: summary,
        display: {
          title: "Document Saved",
          detail: summary,
          conflict: null,
          alternative: null,
          member: null,
          interpreted: "document upload",
        },
        evidence: { source: "System", confidence: "HIGH", grounding_score: null },
        actions: [],
        member_focus: null,
        language: "en",
      },
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-6 gap-6 bg-slate-50">
      <div className="z-10 shrink-0">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <DocumentIcon />
          Medical Documents
        </h1>
        <p className="text-slate-500 mt-1">Upload prescriptions, lab reports, or view family summaries.</p>
      </div>

      <div className="flex-1 flex flex-col z-10 overflow-hidden items-center justify-center">
         {/* Upload Section */}
         <div className="w-full max-w-2xl">
            <UploadDropzone ref={dropzoneRef} onUploadSuccess={handleUploadSuccess}>
              <div 
                className="w-full bg-white rounded-2xl p-12 border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-6 cursor-pointer hover:bg-slate-50/80 transition-all border-dashed"
                onClick={() => dropzoneRef.current?.openFileDialog()}
              >
                 <div className="w-24 h-24 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-5xl">
                    <UploadIcon />
                 </div>
                 <div className="text-center">
                    <h2 className="text-lg font-bold text-slate-800 mb-2">Upload Medical Document</h2>
                    <p className="text-slate-500 max-w-sm text-sm">
                      Drag & drop a prescription, lab report, or hospital discharge summary here, or click to browse.
                    </p>
                 </div>
                 <button className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg shadow-sm hover:bg-blue-700 transition-colors mt-2">
                    Select File
                 </button>
              </div>
            </UploadDropzone>
         </div>
      </div>
    </div>
  );
}
