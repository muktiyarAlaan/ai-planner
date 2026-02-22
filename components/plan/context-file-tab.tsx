"use client";

import { useState, useMemo, useRef, useEffect } from "react";

interface Props {
  planId: string;
  initialMarkdown: string | null;
  onUpdate?: (markdown: string) => void;
  readOnly?: boolean;
}

// ── Lightweight markdown renderer ─────────────────────────────────────────────
function renderInline(text: string): React.ReactNode {
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**"))
      parts.push(
        <strong key={m.index} className="font-semibold text-[#0f172a]">
          {tok.slice(2, -2)}
        </strong>
      );
    else
      parts.push(
        <code
          key={m.index}
          className="text-[11px] text-[#7C3AED] bg-[#f5f3ff] px-1.5 py-px rounded font-mono"
        >
          {tok.slice(1, -1)}
        </code>
      );
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length === 0 ? text : parts.length === 1 ? parts[0] : <>{parts}</>;
}

function RenderedMarkdown({ content }: { content: string }) {
  const elements: React.ReactNode[] = [];
  const lines = content.split("\n");
  let key = 0;
  let inCode = false;
  let codeLang = "";
  let codeLines: string[] = [];
  const pendingList: { type: "ul" | "ol"; items: React.ReactNode[]; num?: number }[] = [];

  function flushList() {
    if (pendingList.length === 0) return;
    const { type, items } = pendingList[pendingList.length - 1];
    if (type === "ul")
      elements.push(
        <ul key={`ul-${key++}`} className="space-y-0.5 my-2 pl-1">
          {items}
        </ul>
      );
    else
      elements.push(
        <ol key={`ol-${key++}`} className="space-y-0.5 my-2 pl-1">
          {items}
        </ol>
      );
    pendingList.pop();
  }

  function pushBullet(text: string) {
    const node = (
      <li key={key++} className="flex items-start gap-2 text-[13px] text-[#374151] leading-relaxed">
        <span className="w-1.5 h-1.5 rounded-full bg-[#7C3AED]/60 mt-[7px] shrink-0" />
        <span>{renderInline(text)}</span>
      </li>
    );
    if (pendingList.length === 0 || pendingList[pendingList.length - 1].type !== "ul")
      pendingList.push({ type: "ul", items: [node] });
    else
      pendingList[pendingList.length - 1].items.push(node);
  }

  function pushNumbered(num: string, text: string) {
    const node = (
      <li key={key++} className="flex items-start gap-2 text-[13px] text-[#374151] leading-relaxed">
        <span className="text-[#7C3AED] font-semibold text-[11px] shrink-0 mt-0.5 min-w-[18px] text-right">
          {num}.
        </span>
        <span>{renderInline(text)}</span>
      </li>
    );
    if (pendingList.length === 0 || pendingList[pendingList.length - 1].type !== "ol")
      pendingList.push({ type: "ol", items: [node] });
    else
      pendingList[pendingList.length - 1].items.push(node);
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trimStart().startsWith("```")) {
      if (inCode) {
        inCode = false;
        elements.push(
          <div key={key++} className="my-3 relative group/cb">
            <div className="flex items-center justify-between bg-[#1e293b] rounded-t-lg px-4 py-1.5">
              <span className="text-[10px] text-[#94a3b8] font-mono font-medium uppercase tracking-wider">
                {codeLang || "code"}
              </span>
            </div>
            <pre className="text-[11.5px] text-[#e2e8f0] font-mono bg-[#0f172a] rounded-b-lg px-4 py-3.5 overflow-auto leading-relaxed">
              {codeLines.join("\n")}
            </pre>
          </div>
        );
        codeLines = [];
        codeLang = "";
      } else {
        flushList();
        inCode = true;
        codeLang = line.trimStart().slice(3).trim();
      }
      continue;
    }
    if (inCode) { codeLines.push(line); continue; }

    if (/^---+$/.test(line.trim())) {
      flushList();
      elements.push(<hr key={key++} className="my-4 border-[#e2e8f0]" />);
      continue;
    }

    if (line.startsWith("# ")) {
      flushList();
      elements.push(
        <h1 key={key++} className="text-xl font-bold text-[#0f172a] mt-7 mb-2 tracking-tight first:mt-0">
          {renderInline(line.slice(2))}
        </h1>
      );
      continue;
    }
    if (line.startsWith("## ")) {
      flushList();
      elements.push(
        <h2 key={key++} className="text-[15px] font-bold text-[#0f172a] mt-6 mb-1.5 pb-1.5 border-b border-[#f1f5f9]">
          {renderInline(line.slice(3))}
        </h2>
      );
      continue;
    }
    if (line.startsWith("### ")) {
      flushList();
      elements.push(
        <h3 key={key++} className="text-[13px] font-semibold text-[#1e293b] mt-4 mb-1">
          {renderInline(line.slice(4))}
        </h3>
      );
      continue;
    }

    if (/^[-*] /.test(line)) {
      pushBullet(line.slice(2));
      continue;
    }

    const numMatch = line.match(/^(\d+)\. (.*)/);
    if (numMatch) {
      pushNumbered(numMatch[1], numMatch[2]);
      continue;
    }

    if (line.trim() === "") {
      flushList();
      elements.push(<div key={key++} className="h-2" />);
      continue;
    }

    flushList();
    elements.push(
      <p key={key++} className="text-[13px] text-[#374151] leading-relaxed">
        {renderInline(line)}
      </p>
    );
  }

  flushList();
  return <>{elements}</>;
}

// ── Toolbar button ─────────────────────────────────────────────────────────────
function ToolbarBtn({
  onClick,
  disabled,
  variant = "ghost",
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost";
  children: React.ReactNode;
}) {
  if (variant === "primary")
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className="flex items-center gap-1.5 text-xs bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 text-white font-medium px-3 py-1.5 rounded-lg transition-colors shadow-sm"
      >
        {children}
      </button>
    );
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 text-xs text-[#64748b] hover:text-[#374151] border border-[#e2e8f0] hover:border-[#cbd5e1] bg-white px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
    >
      {children}
    </button>
  );
}

// ── Save As Dropdown ───────────────────────────────────────────────────────────
const SAVE_OPTIONS = [
  { label: "CLAUDE.md",        filename: "CLAUDE.md" },
  { label: ".cursorrules",     filename: ".cursorrules" },
  { label: ".windsurfrules",   filename: ".windsurfrules" },
  { label: "context.md",       filename: "context.md" },
];

function SaveAsDropdown({ markdown }: { markdown: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function downloadAs(filename: string) {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-[#64748b] hover:text-[#374151] border border-[#e2e8f0] hover:border-[#cbd5e1] bg-white px-2.5 py-1.5 rounded-lg transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Save as…
        <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full mt-1 right-0 bg-white border border-[#e2e8f0] rounded-xl shadow-lg z-20 py-1 min-w-[160px]">
          {SAVE_OPTIONS.map((opt) => (
            <button
              key={opt.filename}
              onClick={() => downloadAs(opt.filename)}
              className="w-full text-left flex items-center gap-2 px-3 py-2 text-[12px] text-[#374151] hover:bg-[#f8fafc] hover:text-[#7C3AED] transition-colors"
            >
              <svg className="w-3.5 h-3.5 text-[#94a3b8] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Collapsible How-To Banner ─────────────────────────────────────────────────
function HowToBanner() {
  const [expanded, setExpanded] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("context-how-to-expanded") === "true";
  });

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    localStorage.setItem("context-how-to-expanded", String(next));
  }

  return (
    <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl overflow-hidden">
      <button
        onClick={toggle}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left hover:bg-[#f1f5f9] transition-colors"
      >
        <span className="text-[13px]">💡</span>
        <span className="text-[12px] font-medium text-[#374151]">How to use this file</span>
        <svg
          className={`w-3.5 h-3.5 text-[#94a3b8] ml-auto transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="px-3.5 pb-3 border-t border-[#e2e8f0] pt-2.5">
          <p className="text-[11px] text-[#64748b] leading-relaxed">
            Copy and save as{" "}
            <code className="bg-[#f0f1fe] text-[#7C3AED] px-1 py-px rounded font-mono text-[10px]">CLAUDE.md</code>,{" "}
            <code className="bg-[#f0f1fe] text-[#7C3AED] px-1 py-px rounded font-mono text-[10px]">.cursorrules</code>, or{" "}
            <code className="bg-[#f0f1fe] text-[#7C3AED] px-1 py-px rounded font-mono text-[10px]">.windsurfrules</code>{" "}
            in your project root to give your AI coding assistant full context about this plan.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function ContextFileTab({ planId, initialMarkdown, onUpdate, readOnly = false }: Props) {
  const [markdown,  setMarkdown]  = useState<string | null>(initialMarkdown);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [copied,    setCopied]    = useState(false);
  const [view,      setView]      = useState<"preview" | "raw">("preview");

  const stats = useMemo(() => {
    if (!markdown) return null;
    const words  = markdown.trim().split(/\s+/).length;
    const lines  = markdown.split("\n").length;
    const tokens = Math.round(words * 1.3);
    return { words, lines, tokens };
  }, [markdown]);

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/ai/context-file", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMarkdown(data.markdown);
      setView("preview");
      onUpdate?.(data.markdown);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate context file");
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard() {
    if (!markdown) return;
    navigator.clipboard.writeText(markdown).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="h-full flex flex-col">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#e2e8f0] bg-white shrink-0 flex-wrap">

        {/* Left: actions */}
        {!readOnly && (
          <ToolbarBtn onClick={generate} disabled={loading} variant="primary">
            {loading ? (
              <>
                <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {markdown ? "Regenerate" : "Generate"}
              </>
            )}
          </ToolbarBtn>
        )}

        {markdown && (
          <div className="flex items-center gap-1.5">
            <ToolbarBtn onClick={copyToClipboard}>
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-emerald-600">Copied!</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </>
              )}
            </ToolbarBtn>

            <SaveAsDropdown markdown={markdown} />
          </div>
        )}

        {/* Right: stats + view toggle */}
        <div className="ml-auto flex items-center gap-3">
          {stats && (
            <div className="flex items-center gap-1.5 text-[11px] text-[#94a3b8]">
              <span>{stats.words.toLocaleString()} words · {stats.lines} lines ·</span>
              <span className="flex items-center gap-1">
                ~{stats.tokens.toLocaleString()} tokens
                <span
                  className="cursor-help relative group/tip"
                  title="Approximate token count when pasting into an AI coding assistant"
                >
                  <svg className="w-3 h-3 text-[#cbd5e1] hover:text-[#94a3b8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
              </span>
            </div>
          )}

          {markdown && (
            <div className="flex items-center bg-[#f1f5f9] rounded-lg p-0.5">
              {(["preview", "raw"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={
                    view === v
                      ? "text-[11px] font-semibold text-[#0f172a] bg-white rounded-md px-2.5 py-1 shadow-sm transition-all"
                      : "text-[11px] font-medium text-[#64748b] px-2.5 py-1 transition-all hover:text-[#374151] capitalize"
                  }
                >
                  {v === "preview" ? "Preview" : "Raw"}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto bg-[#f5f6fa]">
        {error && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-[12px] text-red-600">{error}</p>
          </div>
        )}

        {/* Empty state */}
        {!markdown && !loading && !error && !readOnly && (
          <div className="flex flex-col items-center justify-center h-full text-center px-8 gap-4">
            <div className="w-14 h-14 bg-white border border-[#e2e8f0] rounded-2xl flex items-center justify-center shadow-sm">
              <svg className="w-7 h-7 text-[#94a3b8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[#374151] mb-1">No context file yet</p>
              <p className="text-[12px] text-[#64748b] max-w-xs leading-relaxed">
                Generate a structured markdown document of this plan — paste it into Cursor, Claude Code, or Windsurf as a{" "}
                <code className="text-[11px] text-[#7C3AED] bg-[#f5f3ff] px-1 py-px rounded font-mono">CLAUDE.md</code>
                {" "}or{" "}
                <code className="text-[11px] text-[#7C3AED] bg-[#f5f3ff] px-1 py-px rounded font-mono">.cursorrules</code>
                {" "}file for full implementation context.
              </p>
            </div>
          </div>
        )}

        {/* Read-only empty state */}
        {!markdown && !loading && readOnly && (
          <div className="flex items-center justify-center h-full text-[#94a3b8] text-sm">
            No context file available
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !markdown && (
          <div className="max-w-3xl mx-auto px-8 py-8 space-y-4 animate-pulse">
            <div className="h-6 bg-[#e2e8f0] rounded-lg w-2/5" />
            <div className="h-3 bg-[#e2e8f0] rounded w-full" />
            <div className="h-3 bg-[#e2e8f0] rounded w-5/6" />
            <div className="h-3 bg-[#e2e8f0] rounded w-4/5" />
            <div className="h-4 bg-[#e2e8f0] rounded-lg w-1/3 mt-6" />
            <div className="h-3 bg-[#e2e8f0] rounded w-full" />
            <div className="h-3 bg-[#e2e8f0] rounded w-3/4" />
            <div className="h-20 bg-[#e2e8f0] rounded-xl mt-2" />
          </div>
        )}

        {/* Content (preview or raw) */}
        {markdown && (
          <>
            {/* Collapsible how-to-use banner */}
            <div className="max-w-3xl mx-auto px-6 pt-5">
              <HowToBanner />
            </div>

            {view === "preview" ? (
              <div className="max-w-3xl mx-auto px-6 py-6">
                <div className="bg-white border border-[#e2e8f0] rounded-xl px-8 py-7 shadow-sm">
                  <RenderedMarkdown content={markdown} />
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto px-6 py-6">
                <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 bg-[#f8fafc] border-b border-[#e2e8f0]">
                    <span className="text-[10px] text-[#94a3b8] font-mono font-medium uppercase tracking-wider">
                      context.md
                    </span>
                  </div>
                  <pre className="px-6 py-5 text-[11.5px] text-[#374151] font-mono leading-relaxed whitespace-pre-wrap break-words">
                    {markdown}
                  </pre>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
