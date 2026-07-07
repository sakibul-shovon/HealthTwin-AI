"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useTwinStore } from "@/lib/store";
import { loginUser, registerUser } from "@/lib/api";
import { Shield, Activity, Users, Brain, Lock, Eye, EyeOff, Sparkles } from "lucide-react";

const FEATURES = [
  { icon: Shield,   title: "3-Gate Safety Engine",   desc: "Interaction, contraindication & allergy checks on every medication" },
  { icon: Brain,    title: "AI Voice Assistant",      desc: "Ask in English or Bengali — she remembers your whole family" },
  { icon: Activity, title: "Live Risk Monitoring",    desc: "Real-time health risk scoring with proactive alerts" },
  { icon: Users,    title: "Multi-Member Families",   desc: "Each member has their own digital health twin" },
];

const STATS = [
  { value: "3-Gate", label: "Safety Verification" },
  { value: "20+",    label: "Drug Interactions" },
  { value: "EN/BN",  label: "Bilingual" },
  { value: "100%",   label: "Private & Secure" },
];

// ── Subtle warm background blobs ──────────────────────────────────────────────
function WarmBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div className="absolute rounded-full"
        style={{ width: 500, height: 500, top: -120, left: -80,
          background: "radial-gradient(circle, rgba(15,76,85,0.07) 0%, transparent 70%)" }}
        animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div className="absolute rounded-full"
        style={{ width: 350, height: 350, bottom: -60, left: 100,
          background: "radial-gradient(circle, rgba(226,146,47,0.08) 0%, transparent 70%)" }}
        animate={{ scale: [1, 1.12, 1], opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      <motion.div className="absolute rounded-full"
        style={{ width: 250, height: 250, top: "45%", left: "35%",
          background: "radial-gradient(circle, rgba(15,76,85,0.05) 0%, transparent 70%)" }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 4 }}
      />
    </div>
  );
}

// ── Samantha orb in app color scheme ─────────────────────────────────────────
function SamanthaOrb() {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 100, height: 100 }}>
      {[1, 2, 3].map(i => (
        <motion.div key={i} className="absolute rounded-full border"
          style={{
            width: 100 + i * 26, height: 100 + i * 26,
            borderColor: `rgba(15,76,85,${0.12 - i * 0.03})`,
          }}
          animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 3, repeat: Infinity, delay: i * 0.4 }}
        />
      ))}
      <motion.div
        className="relative z-10 w-24 h-24 rounded-3xl flex items-center justify-center text-white font-black text-4xl select-none"
        style={{
          background: "linear-gradient(135deg, #0F4C55 0%, #1a6b78 50%, #E2922F 100%)",
          backgroundSize: "200% 200%",
          boxShadow: "0 0 32px rgba(15,76,85,0.25), 0 0 64px rgba(226,146,47,0.12)",
        }}
        animate={{
          backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"],
          boxShadow: [
            "0 0 32px rgba(15,76,85,0.25), 0 0 64px rgba(226,146,47,0.12)",
            "0 0 48px rgba(15,76,85,0.4), 0 0 96px rgba(226,146,47,0.2)",
            "0 0 32px rgba(15,76,85,0.25), 0 0 64px rgba(226,146,47,0.12)",
          ],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        S
      </motion.div>
    </div>
  );
}

// ── Auth form ─────────────────────────────────────────────────────────────────
type AuthMode = "login" | "register";

function AuthForm() {
  const router = useRouter();
  const { setAuth } = useTwinStore();

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("demo@healthtwin.ai");
  const [password, setPassword] = useState("Demo1234!");
  const [familyName, setFamilyName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      let result;
      if (mode === "login") {
        result = await loginUser(email, password);
      } else {
        if (!familyName.trim()) { setError("Family name is required"); setLoading(false); return; }
        result = await registerUser(email, password, familyName);
      }
      setAuth({
        user_id: result.user_id,
        email: result.email,
        household_id: result.household_id,
        family_name: result.family_name,
      }, result.token);
      router.push("/home");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    background: "#F7F4ED",
    border: "1.5px solid rgba(23,40,44,0.14)",
    color: "#17282C",
    outline: "none",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="w-full"
    >
      {/* Demo info banner */}
      <div className="w-full mb-4 flex items-center gap-3 px-4 py-3 rounded-2xl"
        style={{
          background: "linear-gradient(135deg, rgba(226,146,47,0.1), rgba(226,146,47,0.06))",
          border: "1.5px solid rgba(226,146,47,0.35)",
        }}
      >
        <Sparkles size={14} style={{ color: "#E2922F" }} className="shrink-0" />
        <span className="text-sm font-semibold" style={{ color: "#A86900" }}>
          Hackathon demo — credentials pre-filled
        </span>
      </div>

      {/* Card */}
      <div className="rounded-3xl overflow-hidden"
        style={{
          background: "#FFFFFF",
          border: "1.5px solid rgba(23,40,44,0.10)",
          boxShadow: "0 12px 48px rgba(16,38,42,0.10), 0 2px 8px rgba(16,38,42,0.06)",
        }}
      >
        {/* Tab toggle */}
        <div className="flex" style={{ borderBottom: "1.5px solid rgba(23,40,44,0.08)" }}>
          {(["login", "register"] as AuthMode[]).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(""); }}
              className="flex-1 py-4 text-sm font-semibold transition-all relative"
              style={{ color: mode === m ? "#0F4C55" : "#8A9696" }}
            >
              {m === "login" ? "Sign In" : "Create Account"}
              {mode === m && (
                <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ background: "linear-gradient(90deg, transparent, #0F4C55, transparent)" }} />
              )}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <AnimatePresence>
            {mode === "register" && (
              <motion.div key="family"
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#58686B" }}>
                  FAMILY NAME
                </label>
                <input
                  type="text" value={familyName} onChange={e => setFamilyName(e.target.value)}
                  placeholder="e.g. Rahman Family"
                  className="w-full px-4 py-3 rounded-xl text-sm transition-all"
                  style={inputStyle}
                  required
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "#58686B" }}>EMAIL</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-4 py-3 rounded-xl text-sm"
              style={inputStyle}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "#58686B" }}>PASSWORD</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 pr-11 rounded-xl text-sm"
                style={inputStyle}
                required minLength={6}
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-70 transition-opacity">
                {showPw ? <EyeOff size={15} color="#17282C" /> : <Eye size={15} color="#17282C" />}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="text-xs px-3 py-2 rounded-xl"
                style={{ background: "rgba(191,51,72,0.08)", color: "#BF3348", border: "1px solid rgba(191,51,72,0.2)" }}>
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.button
            type="submit" disabled={loading}
            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
            className="w-full py-3.5 rounded-xl font-bold text-sm text-white disabled:opacity-60 mt-1 flex items-center justify-center gap-2"
            style={{
              background: "linear-gradient(135deg, #0F4C55, #1a6b78)",
              boxShadow: "0 4px 16px rgba(15,76,85,0.25)",
            }}
          >
            {loading ? (
              <motion.div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white"
                animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} />
            ) : mode === "login" ? "Sign In to Samantha" : "Create Account"}
          </motion.button>
        </form>
      </div>

      <p className="text-center text-[11px] mt-4" style={{ color: "rgba(23,40,44,0.3)" }}>
        Your data stays private. No data sold. Ever.
      </p>
      <p className="text-center text-[10px] mt-1.5" style={{ color: "rgba(226,146,47,0.6)" }}>
        Hackathon demo account active until July 17, 2026 · SciBlitz AI Challenge
      </p>
    </motion.div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { authToken } = useTwinStore();
  const router = useRouter();

  useEffect(() => {
    if (authToken) router.replace("/home");
  }, [authToken, router]);

  return (
    <div className="min-h-screen grid lg:grid-cols-2" style={{ background: "#F7F4ED" }}>

      {/* ── LEFT — Product showcase ─────────────────────────────────────────── */}
      <div className="relative hidden lg:flex flex-col px-14 py-10 overflow-hidden"
        style={{ background: "#F7F4ED" }}>
        <WarmBackground />

        {/* Logo */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="relative z-10 flex items-center gap-3 mb-10">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-white text-sm"
            style={{ background: "linear-gradient(135deg, #0F4C55, #1a6b78)" }}>S</div>
          <span className="font-bold text-base tracking-tight" style={{ color: "#17282C" }}>HealthTwin AI</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
            style={{ background: "rgba(15,76,85,0.1)", color: "#0F4C55", border: "1px solid rgba(15,76,85,0.2)" }}>
            BETA
          </span>
        </motion.div>

        {/* Hero content — vertically centered */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-7">
          <SamanthaOrb />

          <div className="text-center max-w-md">
            <motion.h1
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="text-5xl font-black leading-tight mb-3"
              style={{ color: "#17282C", letterSpacing: "-0.02em" }}
            >
              Meet{" "}
              <span className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(90deg, #0F4C55, #E2922F)" }}>
                Samantha
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="text-sm leading-relaxed" style={{ color: "#58686B" }}
            >
              Your AI-powered family health guardian. She remembers every medication,
              catches dangerous interactions, and answers health questions in English or Bengali — instantly.
            </motion.p>
          </div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="flex gap-8"
          >
            {STATS.map((s, i) => (
              <div key={i} className="text-center">
                <div className="text-lg font-black" style={{ color: "#0F4C55" }}>{s.value}</div>
                <div className="text-[10px] font-semibold mt-0.5" style={{ color: "#8A9696" }}>{s.label}</div>
              </div>
            ))}

          </motion.div>

          {/* Feature cards 2×2 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="grid grid-cols-2 gap-3 w-full max-w-md"
          >
            {FEATURES.map((f, i) => (
              <motion.div key={i}
                whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(15,76,85,0.10)" }}
                className="flex gap-3 p-3.5 rounded-2xl cursor-default transition-all"
                style={{
                  background: "#FFFCF7",
                  border: "1.5px solid rgba(23,40,44,0.08)",
                  boxShadow: "0 2px 8px rgba(16,38,42,0.05)",
                }}
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(15,76,85,0.08)" }}>
                  <f.icon size={14} color="#0F4C55" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold leading-snug" style={{ color: "#17282C" }}>{f.title}</p>
                  <p className="text-[10px] leading-relaxed mt-0.5" style={{ color: "#8A9696" }}>{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Footer badge */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
          className="relative z-10 flex items-center gap-2 mt-6">
          <Lock size={10} style={{ color: "rgba(23,40,44,0.3)" }} />
          <span className="text-[10px]" style={{ color: "rgba(23,40,44,0.35)" }}>
            Built for Bangladeshi families · All data encrypted · Zero third-party sharing
          </span>
        </motion.div>
      </div>

      {/* ── RIGHT — Auth panel ──────────────────────────────────────────────── */}
      <div className="flex flex-col items-center justify-center px-8 py-12 relative"
        style={{ background: "#FFFCF7", borderLeft: "1.5px solid rgba(23,40,44,0.08)" }}>

        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-white text-sm"
            style={{ background: "linear-gradient(135deg, #0F4C55, #1a6b78)" }}>S</div>
          <span className="font-bold" style={{ color: "#17282C" }}>HealthTwin AI</span>
        </div>

        <div className="w-full max-w-sm mb-6">
          <motion.h2
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-black mb-1.5"
            style={{ color: "#17282C", letterSpacing: "-0.01em" }}
          >
            Your family's health,{" "}
            <span className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(90deg, #0F4C55, #E2922F)" }}>
              protected
            </span>
          </motion.h2>
          <p className="text-sm" style={{ color: "#8A9696" }}>
            Sign in or create an account to get started
          </p>
        </div>

        <div className="w-full max-w-sm">
          <AuthForm />
        </div>
      </div>
    </div>
  );
}
