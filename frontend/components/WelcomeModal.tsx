"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Pill, ShieldAlert, Mic, FileText, X, ArrowRight, Sparkles } from "lucide-react";

const HIGHLIGHTS = [
  {
    icon: Pill,
    color: "var(--urgent)",
    bg: "var(--urgent-bg)",
    title: "Drug Safety Check",
    desc: "Ask if any two medications are safe together — instant, evidence-based verdict.",
  },
  {
    icon: ShieldAlert,
    color: "var(--accent)",
    bg: "var(--accent-tint)",
    title: "Emergency SOS",
    desc: "Say 'chest pain' — Samantha surfaces the full medical history before you finish speaking.",
  },
  {
    icon: Mic,
    color: "var(--primary)",
    bg: "var(--primary-tint)",
    title: "Bengali & English Voice",
    desc: "Speak naturally in either language. Samantha detects and responds in kind.",
  },
  {
    icon: FileText,
    color: "var(--well)",
    bg: "var(--well-bg)",
    title: "Prescription OCR",
    desc: "Photo any prescription — Samantha reads it and saves all medications automatically.",
  },
];

const STORAGE_KEY = "ht-welcomed-v1";

export default function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  }

  function explore() {
    dismiss();
    router.push("/get-started");
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)" }}
        >
          <motion.div
            initial={{ scale: 0.93, opacity: 0, y: 18 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.93, opacity: 0, y: 18 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className="w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            {/* Header */}
            <div
              className="relative px-6 pt-8 pb-6 text-center"
              style={{ background: "linear-gradient(160deg, var(--primary-tint) 0%, var(--surface) 100%)" }}
            >
              <button
                onClick={dismiss}
                className="absolute top-4 right-4 p-1.5 rounded-xl transition-opacity opacity-40 hover:opacity-80"
                style={{ color: "var(--ink-soft)" }}
              >
                <X size={16} />
              </button>
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 font-black text-xl text-white shadow-lg"
                style={{ background: "linear-gradient(135deg, var(--primary), var(--accent))" }}
              >
                S
              </div>
              <h2 className="text-xl font-black mb-2" style={{ color: "var(--ink)" }}>
                Meet Samantha
              </h2>
              <p className="text-sm max-w-xs mx-auto leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                Your family's AI health guardian. Here's what she can do for you right now.
              </p>
            </div>

            {/* Feature grid */}
            <div className="px-5 py-4 grid grid-cols-2 gap-2.5">
              {HIGHLIGHTS.map((h) => (
                <div
                  key={h.title}
                  className="rounded-2xl p-3.5 flex flex-col gap-2"
                  style={{ background: "var(--surface-sunk)" }}
                >
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: h.bg }}
                  >
                    <h.icon size={15} style={{ color: h.color }} />
                  </div>
                  <p className="text-[12px] font-bold leading-snug" style={{ color: "var(--ink)" }}>
                    {h.title}
                  </p>
                  <p className="text-[11px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                    {h.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="px-5 pb-5 flex flex-col gap-2 mt-1">
              <button
                onClick={explore}
                className="w-full py-3 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                style={{
                  background: "linear-gradient(135deg, var(--primary), var(--primary-deep))",
                  boxShadow: "var(--shadow-md)",
                }}
              >
                <Sparkles size={14} />
                Show me all features
                <ArrowRight size={14} />
              </button>
              <button
                onClick={dismiss}
                className="w-full py-2.5 rounded-2xl text-sm font-medium transition-opacity hover:opacity-60"
                style={{ color: "var(--ink-soft)" }}
              >
                I'll explore on my own
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
