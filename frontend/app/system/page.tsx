"use client";
import { motion } from "framer-motion";
import {
  Brain, Shield, Mic, FileText, Eye, Activity,
  AlertTriangle, Globe, Search, Database,
  BarChart2, Users, Zap, Network, FlaskConical,
  ChevronRight, Layers, Bot, Cpu,
} from "lucide-react";

// ── Tiny reusable pieces ─────────────────────────────────────────────────────

function Chip({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string; color: string;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.04 }}
      className="glass-card px-4 py-3 flex items-center gap-3 min-w-[110px]"
    >
      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: color + "22" }}>
        <Icon size={15} style={{ color }} />
      </div>
      <div>
        <p className="text-lg font-black leading-none" style={{ color: "var(--ink)" }}>{value}</p>
        <p className="text-[10px] font-semibold mt-0.5" style={{ color: "var(--ink-faint)" }}>{label}</p>
      </div>
    </motion.div>
  );
}

function Arrow({ vertical = false }: { vertical?: boolean }) {
  return vertical ? (
    <div className="flex flex-col items-center gap-0 shrink-0 py-0.5">
      <div className="w-[1.5px] h-4" style={{ background: "var(--border-bright)" }} />
      <div style={{ width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: "6px solid var(--border-bright)" }} />
    </div>
  ) : (
    <div className="flex items-center shrink-0">
      <div className="h-[1.5px] w-5" style={{ background: "var(--border-bright)" }} />
      <div style={{ width: 0, height: 0, borderTop: "4px solid transparent", borderBottom: "4px solid transparent", borderLeft: "6px solid var(--border-bright)" }} />
    </div>
  );
}

function PipeNode({ icon: Icon, label, sub, color, pulse = false }: {
  icon: React.ElementType; label: string; sub?: string; color: string; pulse?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 min-w-[72px]">
      <div className="relative">
        {pulse && (
          <motion.div className="absolute inset-[-5px] rounded-xl"
            style={{ background: color + "33" }}
            animate={{ opacity: [0.4, 1, 0.4], scale: [0.95, 1.08, 0.95] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
        <motion.div whileHover={{ scale: 1.08 }}
          className="relative w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ background: color + "18", border: `1.5px solid ${color}55` }}>
          <Icon size={18} style={{ color }} />
        </motion.div>
      </div>
      <p className="text-[11px] font-bold text-center leading-tight" style={{ color: "var(--ink)" }}>{label}</p>
      {sub && <p className="text-[9px] text-center leading-tight" style={{ color: "var(--ink-faint)" }}>{sub}</p>}
    </div>
  );
}

function GateCard({ num, title, sub, items, color, faded = false }: {
  num: string; title: string; sub: string; items: string[]; color: string; faded?: boolean;
}) {
  return (
    <motion.div whileHover={{ x: 4 }}
      className="glass-card px-4 py-3 flex items-start gap-3"
      style={{ opacity: faded ? 0.5 : 1 }}>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-black text-white"
        style={{ background: color }}>
        {num}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold leading-none" style={{ color: "var(--ink)" }}>{title}</p>
        <p className="text-[10px] mt-0.5 mb-2" style={{ color: "var(--ink-soft)" }}>{sub}</p>
        <div className="flex flex-wrap gap-1">
          {items.map((it, i) => (
            <span key={i} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md"
              style={{ background: color + "18", color }}>
              {it}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function ToolChip({ icon: Icon, label, color }: { icon: React.ElementType; label: string; color: string }) {
  return (
    <motion.div whileHover={{ scale: 1.04 }}
      className="flex items-center gap-2 px-3 py-2 rounded-xl"
      style={{ background: "var(--surface-sunk)", border: "1px solid var(--border)" }}>
      <Icon size={12} style={{ color }} />
      <span className="text-[11px] font-semibold" style={{ color: "var(--ink)" }}>{label}</span>
    </motion.div>
  );
}

function FeatureCard({ icon: Icon, title, tags, color }: {
  icon: React.ElementType; title: string; tags: string[]; color: string;
}) {
  return (
    <motion.div whileHover={{ y: -3 }} className="glass-card p-4 flex flex-col gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: color + "20" }}>
        <Icon size={20} style={{ color }} />
      </div>
      <p className="text-sm font-bold leading-snug" style={{ color: "var(--ink)" }}>{title}</p>
      <div className="flex flex-wrap gap-1.5 mt-auto">
        {tags.map((t, i) => (
          <span key={i} className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
            style={{ background: color + "18", color }}>
            {t}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay },
});

export default function SystemPage() {
  const PETROL  = "#0F4C55";
  const ACCENT  = "#1A7A8A";
  const RED     = "#DC2626";
  const AMBER   = "#D97706";
  const GREEN   = "#16A34A";
  const BLUE    = "#2563EB";
  const PURPLE  = "#7C3AED";

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 shrink-0 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-black" style={{ color: "var(--ink)" }}>AI Architecture</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--ink-soft)" }}>How Samantha thinks — end to end</p>
        </div>
        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
          style={{ background: "var(--primary-tint)", color: "var(--primary)" }}>
          HealthTwin v0.1
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-6 pb-6 space-y-5">

        {/* ── Stats row ────────────────────────────────────────────────────── */}
        <motion.div {...fadeUp(0)} className="flex gap-3 flex-wrap">
          <Chip icon={Brain}   label="LLMs in chain"   value="4"  color={PETROL} />
          <Chip icon={Shield}  label="Safety gates"    value="3"  color={GREEN}  />
          <Chip icon={Zap}     label="Agent tools"     value="8"  color={AMBER}  />
          <Chip icon={Globe}   label="Languages"       value="2"  color={BLUE}   />
          <Chip icon={BarChart2} label="Report types"  value="6"  color={PURPLE} />
        </motion.div>

        {/* ── Request pipeline ─────────────────────────────────────────────── */}
        <motion.div {...fadeUp(0.08)} className="glass-card px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-4"
            style={{ color: "var(--ink-soft)" }}>
            Request Pipeline
          </p>
          <div className="flex items-start gap-1 flex-wrap">
            <PipeNode icon={Mic}         label="Voice / Text" sub="EN · BN"          color={BLUE}   />
            <Arrow />
            <PipeNode icon={Globe}       label="NLU Parse"    sub="15 intents"        color={ACCENT} />
            <Arrow />
            <PipeNode icon={AlertTriangle} label="Triage"     sub="no LLM · 0 ms"    color={RED}    />
            <Arrow />
            <PipeNode icon={Brain}       label="Brain Agent"  sub="LLM tool-calling"  color={PETROL} pulse />
            <Arrow />
            <PipeNode icon={Shield}      label="Safety Gates" sub="G1 → G2 → G3"     color={GREEN}  />
            <Arrow />
            <PipeNode icon={Mic}         label="TTS / Text"   sub="Kokoro · WebSpeech" color={PURPLE} />
          </div>

          {/* Side branch: emergency */}
          <div className="mt-4 flex items-center gap-2 pl-[108px]">
            <div className="w-[1.5px] h-5" style={{ background: RED + "66" }} />
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
              style={{ background: RED + "12", border: `1px solid ${RED}44` }}>
              <AlertTriangle size={11} style={{ color: RED }} />
              <span className="text-[10px] font-bold" style={{ color: RED }}>
                Red-flag hit → Emergency popup bypasses LLM
              </span>
            </div>
          </div>
        </motion.div>

        {/* ── Safety Spine + Brain Tools ───────────────────────────────────── */}
        <motion.div {...fadeUp(0.12)} className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Safety Spine */}
          <div className="flex flex-col gap-0">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2"
              style={{ color: "var(--ink-soft)" }}>
              Safety Spine
            </p>
            <GateCard num="G1" title="Rules Engine" sub="Deterministic · no LLM"
              items={["allergy check", "drug interactions", "dose ranges", "contraindications"]}
              color={RED} />
            <div className="flex flex-col items-center py-1">
              <Arrow vertical />
              <span className="text-[9px] font-semibold px-2" style={{ color: GREEN }}>SAFE only ↓</span>
            </div>
            <GateCard num="G2" title="RAG + Rerank" sub="Grounded explanation"
              items={["bge-base-en-v1.5", "BM25", "ms-marco CrossEncoder"]}
              color={ACCENT} />
            <div className="flex flex-col items-center py-1">
              <Arrow vertical />
            </div>
            <GateCard num="G3" title="NLI Entailment" sub="Hallucination filter"
              items={["disabled on demo host", "OOM guard"]}
              color={PURPLE} faded />
          </div>

          {/* Brain Agent Tools */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-0"
              style={{ color: "var(--ink-soft)" }}>
              Brain Agent · 8 Tools
            </p>
            <div className="relative glass-card p-3">
              <motion.div className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background: PETROL + "22" }}
                animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                <Brain size={12} style={{ color: PETROL }} />
              </motion.div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-1">
                <ToolChip icon={Users}        label="Member info"      color={BLUE}   />
                <ToolChip icon={Shield}       label="Drug safety"      color={RED}    />
                <ToolChip icon={Search}       label="Medical search"   color={ACCENT} />
                <ToolChip icon={Activity}     label="Log symptom"      color={AMBER}  />
                <ToolChip icon={Users}        label="Family overview"  color={BLUE}   />
                <ToolChip icon={Network}      label="Pattern check"    color={PURPLE} />
                <ToolChip icon={Database}     label="Write profile"    color={GREEN}  />
                <ToolChip icon={BarChart2}    label="Generate report"  color={PETROL} />
              </div>
              <p className="text-[9px] mt-2 text-center" style={{ color: "var(--ink-faint)" }}>
                ≤ 2 LLM calls per turn · never invents patient data
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Feature cards ─────────────────────────────────────────────────── */}
        <motion.div {...fadeUp(0.16)}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2"
            style={{ color: "var(--ink-soft)" }}>
            AI Features
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <FeatureCard icon={Eye}  title="Vision OCR" color={BLUE}
              tags={["Llama 4 Scout", "base64", "prescriptions", "PDFs"]} />
            <FeatureCard icon={FlaskConical} title="Pattern Detection" color={PURPLE}
              tags={["fever cluster", "≥2 members", "dengue season", "hereditary"]} />
            <FeatureCard icon={AlertTriangle} title="Emergency Triage" color={RED}
              tags={["zero-LLM", "red-flag scan", "Bengali KW", "temp extract"]} />
            <FeatureCard icon={Globe} title="Bilingual NLU" color={ACCENT}
              tags={["EN / BN", "Bengali detect", "15 intents", "Groq LLM"]} />
          </div>
        </motion.div>

        {/* ── Model fallback chain ──────────────────────────────────────────── */}
        <motion.div {...fadeUp(0.2)} className="glass-card px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3"
            style={{ color: "var(--ink-soft)" }}>
            Model Fallback Chain
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { label: "llama-3.3-70b", sub: "Primary", color: PETROL, tag: "1st" },
              { label: "gpt-oss-120b",  sub: "Fallback 1", color: BLUE,   tag: "2nd" },
              { label: "llama-4-scout-17b", sub: "Fallback 2", color: ACCENT, tag: "3rd" },
              { label: "llama-3.1-8b",  sub: "Last resort", color: AMBER, tag: "4th" },
            ].map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <motion.div whileHover={{ scale: 1.04 }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: m.color + "14", border: `1.5px solid ${m.color}44` }}>
                  <span className="text-[9px] font-black px-1 py-0.5 rounded"
                    style={{ background: m.color, color: "#fff" }}>
                    {m.tag}
                  </span>
                  <div>
                    <p className="text-[11px] font-bold font-mono leading-none" style={{ color: m.color }}>{m.label}</p>
                    <p className="text-[9px] mt-0.5" style={{ color: "var(--ink-faint)" }}>{m.sub}</p>
                  </div>
                </motion.div>
                {i < 3 && <ChevronRight size={13} style={{ color: "var(--border-bright)" }} />}
              </div>
            ))}
          </div>
          <p className="text-[9px] mt-3" style={{ color: "var(--ink-faint)" }}>
            All via Groq API · auto-retry on 429 / 503 · Vision LLM: Llama 4 Scout (multimodal)
          </p>
        </motion.div>

        {/* ── Data model ───────────────────────────────────────────────────── */}
        <motion.div {...fadeUp(0.22)} className="glass-card px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3"
            style={{ color: "var(--ink-soft)" }}>
            Knowledge Graph
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            {[
              { label: "Household", color: PETROL },
              { label: "Member",    color: BLUE   },
              { label: "Medication",color: RED    },
              { label: "Condition", color: AMBER  },
              { label: "Allergy",   color: PURPLE },
              { label: "SymptomLog",color: GREEN  },
              { label: "KBChunk",   color: ACCENT },
              { label: "AgentTrace",color: PETROL },
              { label: "ChatSession",color: BLUE  },
              { label: "Document",  color: AMBER  },
            ].map((node, i) => (
              <motion.span key={i} whileHover={{ scale: 1.06 }}
                className="text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-default"
                style={{ background: node.color + "18", color: node.color, border: `1px solid ${node.color}33` }}>
                {node.label}
              </motion.span>
            ))}
          </div>
          <p className="text-[9px] mt-2" style={{ color: "var(--ink-faint)" }}>
            PostgreSQL + pgvector · SQLAlchemy ORM · vector embeddings on KBChunk
          </p>
        </motion.div>

      </div>
    </div>
  );
}
