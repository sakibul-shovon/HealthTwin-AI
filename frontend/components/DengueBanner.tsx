"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";

interface Props {
  conflict: string | null;
  verdict: string | null;
}

export default function DengueBanner({ conflict, verdict }: Props) {
  const [dismissed, setDismissed] = useState(false);

  const isDengue =
    !dismissed &&
    verdict === "CAUTION" &&
    conflict != null &&
    /fever|dengue|cluster/i.test(conflict);

  return (
    <AnimatePresence>
      {isDengue && (
        <motion.div
          initial={{ opacity: 0, height: 0, y: -8 }}
          animate={{ opacity: 1, height: "auto", y: 0 }}
          exit={{ opacity: 0, height: 0, y: -8 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="mx-6 mb-3 overflow-hidden rounded-2xl shrink-0"
          style={{
            background: "linear-gradient(135deg, #7B1818 0%, #BF3348 100%)",
            boxShadow: "0 4px 24px rgba(191,51,72,0.30)",
          }}
        >
          <div className="flex items-start gap-3 px-4 py-3">
            {/* Pulsing icon */}
            <div className="relative shrink-0 mt-0.5">
              <motion.div
                className="absolute inset-[-5px] rounded-full bg-white opacity-20"
                animate={{ scale: [1, 1.6, 1], opacity: [0.2, 0, 0.2] }}
                transition={{ duration: 1.8, repeat: Infinity }}
              />
              <AlertTriangle size={16} className="text-white relative z-10" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-black uppercase tracking-widest text-white opacity-80">
                Dengue Alert · Active Season
              </p>
              <p className="text-sm font-semibold text-white leading-snug mt-0.5">
                {conflict}
              </p>
              <p className="text-[11px] text-white opacity-70 mt-0.5">
                WHO guidance recommends NS1 antigen test within 24–48 hours of symptom onset.
              </p>
            </div>

            <button
              onClick={() => setDismissed(true)}
              className="shrink-0 mt-0.5 text-white opacity-60 hover:opacity-100 transition-opacity"
            >
              <X size={14} />
            </button>
          </div>

          {/* Animated bottom stripe */}
          <motion.div
            className="h-[2px] w-full"
            style={{ background: "rgba(255,255,255,0.25)", transformOrigin: "left" }}
            animate={{ scaleX: [0, 1] }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
