"use client";

import { useState, useCallback } from "react";
import { ReportData } from "@/lib/types";

// ── Inline Markdown renderer ──────────────────────────────────────────────────
// Handles the subset used by the report templates:
// headings (#/##/###), bold (**), horizontal rules (---), tables (|), lists (-).
// No external dependency — keeps bundle lean.

function applyInline(text: string): (string | JSX.Element)[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  );
}

function renderMarkdown(md: string): JSX.Element {
  const lines = md.split("\n");
  const out: JSX.Element[] = [];
  let tableRows: string[][] = [];
  let listItems: string[] = [];
  let key = 0;
  const k = () => key++;

  const flushList = () => {
    if (!listItems.length) return;
    out.push(
      <ul key={k()} className="list-disc list-inside space-y-0.5 text-sm text-gray-700 my-1.5 pl-1">
        {listItems.map((item, i) => (
          <li key={i}>{applyInline(item)}</li>
        ))}
      </ul>
    );
    listItems = [];
  };

  const flushTable = () => {
    if (!tableRows.length) return;
    // Filter out separator rows (---|---)
    const dataRows = tableRows.filter(r => !r.every(c => /^[-: ]+$/.test(c)));
    if (!dataRows.length) { tableRows = []; return; }
    const [header, ...body] = dataRows;
    out.push(
      <div key={k()} className="overflow-x-auto my-2">
        <table className="w-full text-xs border-collapse rounded-lg overflow-hidden border border-gray-200">
          <thead>
            <tr className="bg-gray-50">
              {header.map((cell, i) => (
                <th key={i} className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider text-[10px]">
                  {applyInline(cell.trim())}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                {row.map((cell, ci) => (
                  <td key={ci} className="border border-gray-200 px-3 py-2 text-gray-700">
                    {applyInline(cell.trim())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableRows = [];
  };

  for (const raw of lines) {
    const line = raw;

    // Heading
    const h3 = line.match(/^### (.+)/);
    const h2 = line.match(/^## (.+)/);
    const h1 = line.match(/^# (.+)/);
    if (h1 || h2 || h3) {
      flushList(); flushTable();
      if (h1) out.push(<h1 key={k()} className="text-base font-bold text-gray-900 mt-4 mb-1">{applyInline(h1[1])}</h1>);
      else if (h2) out.push(<h2 key={k()} className="text-sm font-bold text-gray-800 mt-3 mb-1 border-b border-gray-100 pb-0.5">{applyInline(h2[1])}</h2>);
      else if (h3) out.push(<h3 key={k()} className="text-xs font-bold text-gray-700 mt-2 mb-0.5 uppercase tracking-wider">{applyInline(h3[1])}</h3>);
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      flushList(); flushTable();
      out.push(<hr key={k()} className="border-gray-200 my-2" />);
      continue;
    }

    // Table row
    if (line.trim().startsWith("|")) {
      flushList();
      const cells = line.trim().replace(/^\||\|$/g, "").split("|");
      tableRows.push(cells);
      continue;
    }

    // List item
    if (/^- /.test(line)) {
      flushTable();
      listItems.push(line.slice(2));
      continue;
    }

    // Empty line
    if (!line.trim()) {
      flushList(); flushTable();
      continue;
    }

    // Paragraph
    flushList(); flushTable();
    out.push(
      <p key={k()} className="text-sm text-gray-700 leading-relaxed my-1">
        {applyInline(line)}
      </p>
    );
  }
  flushList();
  flushTable();

  return <>{out}</>;
}

// ── Download helper ───────────────────────────────────────────────────────────
function downloadMd(title: string, markdown: string) {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── ReportView component ──────────────────────────────────────────────────────

interface ReportViewProps {
  report: ReportData;
  onClose?: () => void;
  compact?: boolean; // true → inline card in chat thread
}

export default function ReportView({ report, onClose, compact = false }: ReportViewProps) {
  const [expanded, setExpanded] = useState(!compact);
  const handleDownload = useCallback(() => downloadMd(report.title, report.markdown), [report]);

  if (compact) {
    return (
      <div className="mt-2 rounded-xl border border-indigo-100 bg-indigo-50/50 overflow-hidden">
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-indigo-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs">📄</span>
            <span className="text-xs font-semibold text-indigo-700 truncate max-w-[180px]">{report.title}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={e => { e.stopPropagation(); handleDownload(); }}
              className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 px-1.5 py-0.5 rounded bg-indigo-100 hover:bg-indigo-200 transition-colors"
            >
              ⬇ .md
            </button>
            <span className="text-indigo-400 text-xs">{expanded ? "▲" : "▼"}</span>
          </div>
        </button>
        {expanded && (
          <div className="px-3 pb-3 overflow-x-auto max-h-[380px] overflow-y-auto scrollbar-thin">
            <div className="prose-sm">{renderMarkdown(report.markdown)}</div>
          </div>
        )}
      </div>
    );
  }

  // Full panel mode (used inside MemberTwin)
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base">📄</span>
          <span className="text-sm font-bold text-gray-800 truncate">{report.title}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleDownload}
            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors"
          >
            ⬇ Download .md
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-[11px] font-semibold text-gray-500 hover:text-gray-700 px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              ✕ Close
            </button>
          )}
        </div>
      </div>

      {/* Rendered Markdown */}
      <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar">
        {renderMarkdown(report.markdown)}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 py-2 border-t border-gray-100 text-[10px] text-gray-400">
        Generated {new Date(report.generated_at).toLocaleString()} · HealthTwin graph data
      </div>
    </div>
  );
}
