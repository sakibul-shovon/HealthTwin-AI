"use client";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/shell/PageHeader";
import {
  Pill, ShieldAlert, Mic, FileText, Activity, BarChart2,
  ArrowRight, Sparkles, MessageCircle, ChevronRight,
} from "lucide-react";

const FEATURES = [
  {
    icon: Pill,
    color: "var(--urgent)",
    bg: "var(--urgent-bg)",
    tag: "Safety Gate · No LLM",
    title: "Drug Safety Check",
    desc: "Ask if any medication is safe for a family member. Samantha checks drug interactions, contraindications, and patient-specific flags like kidney impairment — instantly, with zero hallucination risk.",
    example: '"Is it safe to give Baba Aspirin with his current medications?"',
    href: "/ask",
    cta: "Open Conversations",
  },
  {
    icon: ShieldAlert,
    color: "var(--accent)",
    bg: "var(--accent-tint)",
    tag: "Emergency AI",
    title: "Emergency SOS",
    desc: "Mention chest pain or difficulty breathing and Samantha opens a full emergency card before you finish the sentence — blood group, conditions, medications, allergies, and a one-tap 999 call.",
    example: '"Baba suddenly has chest pain and cannot breathe"',
    href: "/emergency",
    cta: "See Emergency page",
  },
  {
    icon: Mic,
    color: "var(--primary)",
    bg: "var(--primary-tint)",
    tag: "Bilingual Voice",
    title: "Bengali & English",
    desc: "Speak naturally in Bengali or English. Samantha detects the language automatically and responds in the same language — no switching, no settings.",
    example: '"মা-র কি কোনো অ্যালার্জি আছে?"',
    href: "/ask",
    cta: "Try voice",
  },
  {
    icon: FileText,
    color: "var(--well)",
    bg: "var(--well-bg)",
    tag: "Vision AI · OCR",
    title: "Prescription OCR",
    desc: "Drag or upload any photo of a handwritten or printed prescription. Samantha reads it using a multimodal AI model and saves all medications and diagnoses directly to the chosen family member.",
    example: "Drag a prescription photo onto the Records page",
    href: "/records",
    cta: "Go to Records",
  },
  {
    icon: Activity,
    color: "var(--info)",
    bg: "var(--info-bg)",
    tag: "Pattern Detection",
    title: "Symptom Cluster Alert",
    desc: "Samantha monitors the whole family simultaneously. If two members log similar symptoms within 48 hours, she flags it as a cluster — and in dengue season escalates the warning automatically.",
    example: '"Are there any symptom patterns in our family recently?"',
    href: "/ask",
    cta: "Ask Samantha",
  },
  {
    icon: BarChart2,
    color: "var(--primary-deep)",
    bg: "var(--primary-tint)",
    tag: "Reports · 6 types",
    title: "Doctor-Ready Reports",
    desc: "Generate a full family health summary, medication list, disease history, or doctor-visit prep sheet in seconds. Download as PDF and hand it to any doctor for instant context.",
    example: "Reports → Generate Family Summary",
    href: "/reports",
    cta: "Open Reports",
  },
];

const QUICK_COMMANDS = [
  { text: "Is it safe to give Baba Aspirin with his current medications?", lang: "EN" },
  { text: "Baba suddenly has chest pain and cannot breathe", lang: "EN" },
  { text: "মা-র কি কোনো অ্যালার্জি আছে?", lang: "BN" },
  { text: "Are there any symptom patterns in our family recently?", lang: "EN" },
  { text: "Log a fever for Ayaan, severity 7", lang: "EN" },
  { text: "Give me a summary of our family health", lang: "EN" },
];

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { type: "spring", stiffness: 260, damping: 22, delay: i * 0.07 },
  }),
};

export default function GetStartedPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col h-full overflow-hidden pb-10">
      <PageHeader
        title="Get Started"
        subtitle="Everything Samantha can do for your family"
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-6 space-y-8">

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-3xl p-6 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-deep) 100%)" }}
        >
          <div
            className="absolute right-0 top-0 w-48 h-48 rounded-full pointer-events-none"
            style={{ background: "var(--accent)", opacity: 0.08, transform: "translate(35%,-35%)" }}
          />
          <Sparkles size={22} color="var(--accent)" className="mb-3" />
          <h2 className="text-xl font-black text-white mb-1.5">How to use Samantha</h2>
          <p className="text-sm text-white/65 max-w-md leading-relaxed">
            Tap the mic at the bottom of any page and speak — or type. Below are the six most powerful things Samantha can do for your family.
          </p>
        </motion.div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate="show"
              className="flex flex-col rounded-2xl overflow-hidden"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
            >
              {/* Top */}
              <div className="px-5 pt-5 pb-3 flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: f.bg }}
                >
                  <f.icon size={18} style={{ color: f.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <span
                    className="text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: f.color }}
                  >
                    {f.tag}
                  </span>
                  <h3 className="text-[15px] font-bold leading-snug mt-0.5" style={{ color: "var(--ink)" }}>
                    {f.title}
                  </h3>
                </div>
              </div>

              {/* Description */}
              <p className="px-5 text-[13px] leading-relaxed flex-1" style={{ color: "var(--ink-soft)" }}>
                {f.desc}
              </p>

              {/* Example */}
              <div
                className="mx-5 mt-4 px-3.5 py-2.5 rounded-xl"
                style={{ background: "var(--surface-sunk)" }}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--ink-faint)" }}>
                  Try saying
                </p>
                <p className="text-[12px] italic" style={{ color: "var(--ink-soft)" }}>{f.example}</p>
              </div>

              {/* CTA */}
              <div className="px-5 py-4">
                <button
                  onClick={() => router.push(f.href)}
                  className="flex items-center gap-1.5 text-[13px] font-bold transition-opacity hover:opacity-60"
                  style={{ color: f.color }}
                >
                  {f.cta} <ArrowRight size={13} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Quick command reference */}
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--ink-soft)" }}>
            Quick commands to try right now
          </h3>
          <div className="flex flex-col gap-2">
            {QUICK_COMMANDS.map((cmd, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.05 }}
                onClick={() => router.push("/ask")}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all hover:scale-[1.01] active:scale-[0.99] group"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <MessageCircle size={14} style={{ color: "var(--primary)", flexShrink: 0 }} />
                <span className="text-[13px] font-medium flex-1" style={{ color: "var(--ink)" }}>
                  {cmd.text}
                </span>
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0"
                  style={{
                    background: cmd.lang === "BN" ? "var(--accent-tint)" : "var(--primary-tint)",
                    color: cmd.lang === "BN" ? "var(--accent-deep)" : "var(--primary)",
                  }}
                >
                  {cmd.lang}
                </span>
                <ChevronRight size={13} style={{ color: "var(--ink-faint)" }} className="shrink-0" />
              </motion.button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
