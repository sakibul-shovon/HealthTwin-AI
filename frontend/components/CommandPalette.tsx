"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HouseholdMember } from "@/lib/types";

interface Command {
  id: string;
  icon: string;
  label: string;
  description?: string;
  action: () => void;
  keywords?: string[];
}

interface Props {
  members: HouseholdMember[];
  onCommand: (transcript: string) => void;
  onSelectMember: (label: string) => void;
  onScan: () => void;
}

export default function CommandPalette({ members, onCommand, onSelectMember, onScan }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  const run = useCallback((fn: () => void) => {
    fn();
    close();
  }, [close]);

  const QUICK_QUERIES = [
    { label: "Is ibuprofen safe for Baba?", icon: "💊" },
    { label: "Check household patterns",     icon: "🔍" },
    { label: "Family health overview",        icon: "👨‍👩‍👧‍👦" },
    { label: "Baba er ki ki oshudh ache?",   icon: "📋" },
    { label: "Is aspirin safe for Baba?",    icon: "⚠" },
    { label: "Log fever for Ma",             icon: "🤒" },
  ];

  const commands: Command[] = [
    // Members
    ...members.map((m) => ({
      id: `member-${m.id}`,
      icon: "👤",
      label: `View ${m.role_label}`,
      description: `${m.age}y · ${m.medications.length} meds`,
      keywords: [m.role_label.toLowerCase(), m.display_name.toLowerCase(), "member", "twin"],
      action: () => onSelectMember(m.role_label),
    })),
    // Quick queries
    ...QUICK_QUERIES.map((q) => ({
      id: `query-${q.label}`,
      icon: q.icon,
      label: q.label,
      keywords: q.label.toLowerCase().split(/\s+/),
      action: () => onCommand(q.label),
    })),
    // Special actions
    {
      id: "scan",
      icon: "📷",
      label: "Scan Prescription",
      description: "Upload a photo or PDF",
      keywords: ["scan", "upload", "photo", "prescription", "rx", "lab"],
      action: onScan,
    },
  ];

  const filtered = query.trim()
    ? commands.filter((c) => {
        const q = query.toLowerCase();
        return (
          c.label.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.keywords?.some((k) => k.includes(q))
        );
      })
    : commands;

  // If query looks like a free-form question, offer to send it
  const isQuestion = query.trim().length > 4 && !filtered.some((c) => c.label.toLowerCase() === query.toLowerCase());

  return (
    <>
      {/* ⌘K hint chip in header area */}
      <button
        onClick={() => setOpen(true)}
        className="hidden sm:flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full transition-all hover:opacity-80"
        style={{
          background: "var(--glass-bright)",
          border: "1px solid var(--border)",
          color: "var(--ink-soft)",
        }}
        title="Open command palette"
      >
        <span>⌘K</span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-[100]"
              style={{ background: "rgba(15,28,32,0.45)", backdropFilter: "blur(4px)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={close}
            />

            {/* Palette */}
            <motion.div
              className="fixed left-1/2 top-[18%] z-[101] w-full max-w-lg"
              style={{ transform: "translateX(-50%)" }}
              initial={{ opacity: 0, y: -16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border-bright)",
                  boxShadow: "var(--shadow-lg), 0 0 0 1px rgba(15,76,85,0.08)",
                }}
              >
                {/* Search input */}
                <div
                  className="flex items-center gap-3 px-4 py-3.5"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="var(--ink-faint)" strokeWidth="2.2" strokeLinecap="round">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (isQuestion) run(() => onCommand(query.trim()));
                        else if (filtered[0]) run(filtered[0].action);
                      }
                    }}
                    placeholder="Search members, commands, or ask a question…"
                    className="flex-1 text-sm bg-transparent outline-none"
                    style={{ color: "var(--ink)" }}
                  />
                  <kbd
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ background: "var(--surface-sunk)", color: "var(--ink-faint)", fontFamily: "monospace" }}
                  >
                    ESC
                  </kbd>
                </div>

                {/* Results list */}
                <div className="max-h-72 overflow-y-auto py-1.5">
                  {filtered.length === 0 && !isQuestion && (
                    <p className="px-4 py-6 text-sm text-center" style={{ color: "var(--ink-faint)" }}>
                      No matches
                    </p>
                  )}

                  {/* Free-form question row */}
                  {isQuestion && (
                    <button
                      onClick={() => run(() => onCommand(query.trim()))}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--primary-tint)]"
                    >
                      <span className="text-base shrink-0">↵</span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: "var(--primary)" }}>
                          Ask: &ldquo;{query}&rdquo;
                        </p>
                        <p className="text-[10px]" style={{ color: "var(--ink-faint)" }}>Send as voice command</p>
                      </div>
                    </button>
                  )}

                  {/* Section: Members */}
                  {filtered.some((c) => c.id.startsWith("member-")) && (
                    <div className="px-4 pt-2 pb-1">
                      <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--ink-faint)" }}>
                        Family Members
                      </p>
                    </div>
                  )}
                  {filtered
                    .filter((c) => c.id.startsWith("member-"))
                    .map((c) => (
                      <CommandRow key={c.id} cmd={c} onRun={run} />
                    ))}

                  {/* Section: Commands & Queries */}
                  {filtered.some((c) => !c.id.startsWith("member-")) && (
                    <div className="px-4 pt-2 pb-1">
                      <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--ink-faint)" }}>
                        Commands
                      </p>
                    </div>
                  )}
                  {filtered
                    .filter((c) => !c.id.startsWith("member-"))
                    .map((c) => (
                      <CommandRow key={c.id} cmd={c} onRun={run} />
                    ))}
                </div>

                {/* Footer hint */}
                <div
                  className="px-4 py-2 flex items-center gap-3"
                  style={{ borderTop: "1px solid var(--border)", background: "var(--surface-sunk)" }}
                >
                  <span className="text-[10px]" style={{ color: "var(--ink-faint)" }}>
                    <kbd style={{ fontFamily: "monospace" }}>↑↓</kbd> navigate · <kbd style={{ fontFamily: "monospace" }}>↵</kbd> select · <kbd style={{ fontFamily: "monospace" }}>ESC</kbd> close
                  </span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function CommandRow({ cmd, onRun }: { cmd: Command; onRun: (fn: () => void) => void }) {
  return (
    <button
      onClick={() => onRun(cmd.action)}
      className="w-full flex items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-[var(--primary-tint)]"
    >
      <span className="text-base shrink-0 w-6 text-center">{cmd.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate" style={{ color: "var(--ink)" }}>{cmd.label}</p>
        {cmd.description && (
          <p className="text-[10px] truncate" style={{ color: "var(--ink-faint)" }}>{cmd.description}</p>
        )}
      </div>
    </button>
  );
}
