"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  SecurityReview,
  SecurityCheckItem,
  ThreatModelItem,
  SecurityRecommendation,
  SecurityStatus,
  SecurityCategory,
  SecurityLikelihood,
} from "@/types/plan";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_ORDER: Record<SecurityStatus, number> = { FAIL: 0, WARN: 1, PASS: 2, INFO: 3 };

const STATUS_META: Record<SecurityStatus, { bar: string; border: string; badge: string; label: string }> = {
  FAIL: { bar: "#ef4444", border: "#ef4444", badge: "bg-red-50 text-red-600 border-red-200",     label: "Failed"  },
  WARN: { bar: "#f59e0b", border: "#f59e0b", badge: "bg-amber-50 text-amber-600 border-amber-200", label: "Warning" },
  PASS: { bar: "#10b981", border: "#10b981", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Passed" },
  INFO: { bar: "#3b82f6", border: "#3b82f6", badge: "bg-blue-50 text-blue-600 border-blue-200",   label: "Info"    },
};

const CATEGORY_STYLES: Record<SecurityCategory, string> = {
  Auth:    "bg-violet-50 text-violet-600 border-violet-200",
  Data:    "bg-blue-50 text-blue-600 border-blue-200",
  API:     "bg-emerald-50 text-emerald-600 border-emerald-200",
  Input:   "bg-amber-50 text-amber-600 border-amber-200",
  Logging: "bg-cyan-50 text-cyan-600 border-cyan-200",
  Infra:   "bg-orange-50 text-orange-600 border-orange-200",
};

const PRIORITY_META: Record<number, { badge: string; label: string }> = {
  1: { badge: "bg-red-50 text-red-600 border-red-200",      label: "P1" },
  2: { badge: "bg-amber-50 text-amber-600 border-amber-200", label: "P2" },
  3: { badge: "bg-blue-50 text-blue-600 border-blue-200",    label: "P3" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getRiskLevel(summary: SecurityReview["summary"]) {
  if (summary.failed >= 3) return { label: "High Risk",    color: "text-red-600",    bg: "bg-red-50 border-red-200",    bar: "#ef4444" };
  if (summary.failed > 0)  return { label: "Medium Risk",  color: "text-amber-600",  bg: "bg-amber-50 border-amber-200", bar: "#f59e0b" };
  if (summary.warnings > 0) return { label: "Low Risk",    color: "text-amber-500",  bg: "bg-amber-50/60 border-amber-100", bar: "#fbbf24" };
  return                           { label: "Secure",       color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", bar: "#10b981" };
}

function getThreatRisk(likelihood: SecurityLikelihood, impact: SecurityLikelihood) {
  if (likelihood === "High"   && impact === "High")   return { label: "Critical", style: "bg-red-100 text-red-700 border-red-300",      bar: "#dc2626" };
  if (likelihood === "High"   || impact === "High")   return { label: "High",     style: "bg-red-50 text-red-600 border-red-200",        bar: "#ef4444" };
  if (likelihood === "Medium" || impact === "Medium") return { label: "Medium",   style: "bg-amber-50 text-amber-600 border-amber-200",  bar: "#f59e0b" };
  return                                                     { label: "Low",      style: "bg-[#f8fafc] text-[#64748b] border-[#e2e8f0]", bar: "#94a3b8" };
}

// ── Small reusable pieces ─────────────────────────────────────────────────────

function StatusIcon({ status }: { status: SecurityStatus }) {
  if (status === "PASS")
    return (
      <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    );
  if (status === "WARN")
    return (
      <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    );
  if (status === "FAIL")
    return (
      <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  return (
    <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 110 20A10 10 0 0112 2z" />
    </svg>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }
  return (
    <button
      onClick={copy}
      className={cn(
        "flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md transition-colors",
        copied ? "text-emerald-600 bg-emerald-50" : "text-[#94a3b8] hover:text-[#64748b] hover:bg-[#f1f5f9]"
      )}
    >
      {copied ? (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({
  summary,
  onRegenerate,
  regenerating,
}: {
  summary: SecurityReview["summary"];
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const total = summary.passed + summary.warnings + summary.failed;
  const risk  = getRiskLevel(summary);

  return (
    <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 space-y-4">
      {/* Top row: risk badge + counts + regenerate */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Shield icon */}
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border", risk.bg)}>
            <svg className={cn("w-5 h-5", risk.color)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <p className={cn("text-[13px] font-bold", risk.color)}>{risk.label}</p>
            <p className="text-[11px] text-[#94a3b8]">{total} checks reviewed</p>
          </div>
        </div>

        {/* Stat pills */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {summary.failed > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              {summary.failed} failed
            </span>
          )}
          {summary.warnings > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              {summary.warnings} warnings
            </span>
          )}
          {summary.passed > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              {summary.passed} passed
            </span>
          )}
        </div>
      </div>

      {/* Segmented progress bar */}
      <div className="w-full h-2 bg-[#f1f5f9] rounded-full overflow-hidden flex gap-px">
        {summary.failed > 0 && (
          <div className="bg-red-500 h-full rounded-l-full" style={{ width: `${(summary.failed / total) * 100}%` }} />
        )}
        {summary.warnings > 0 && (
          <div
            className="bg-amber-400 h-full"
            style={{
              width: `${(summary.warnings / total) * 100}%`,
              borderRadius: summary.failed === 0 ? "9999px 0 0 9999px" : undefined,
            }}
          />
        )}
        {summary.passed > 0 && (
          <div
            className="bg-emerald-500 h-full rounded-r-full"
            style={{ width: `${(summary.passed / total) * 100}%` }}
          />
        )}
      </div>

      {/* Regenerate */}
      <div className="flex items-center justify-between pt-1 border-t border-[#f1f5f9]">
        <p className="text-[11px] text-[#94a3b8]">AI-generated from your plan&apos;s entities, APIs and user flows</p>
        <button
          onClick={onRegenerate}
          disabled={regenerating}
          className="flex items-center gap-1.5 text-[11px] font-medium text-[#7C3AED] hover:text-[#6D28D9] disabled:opacity-50 transition-colors"
        >
          <svg className={cn("w-3.5 h-3.5", regenerating && "animate-spin")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {regenerating ? "Regenerating…" : "Regenerate"}
        </button>
      </div>
    </div>
  );
}

// ── Checklist item ─────────────────────────────────────────────────────────────

function ChecklistItem({ item }: { item: SecurityCheckItem }) {
  const meta          = STATUS_META[item.status];
  const categoryStyle = CATEGORY_STYLES[item.category] ?? "bg-[#f8fafc] text-[#64748b] border-[#e2e8f0]";

  return (
    <div
      className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden hover:border-[#c7d2fe] transition-all group/check"
      style={{ borderLeft: `3px solid ${meta.border}` }}
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        <div className="mt-0.5 shrink-0">
          <StatusIcon status={item.status} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", categoryStyle)}>
              {item.category}
            </span>
            <span className="text-[13px] font-semibold text-[#0f172a] leading-snug">
              {item.title}
            </span>
          </div>
          <p className="text-[12px] text-[#64748b] leading-relaxed">{item.description}</p>
        </div>
        {/* Status label on the right */}
        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 mt-0.5", meta.badge)}>
          {meta.label}
        </span>
      </div>
    </div>
  );
}

// ── Threat model ──────────────────────────────────────────────────────────────

function ThreatItem({ threat }: { threat: ThreatModelItem }) {
  const risk = getThreatRisk(threat.likelihood, threat.impact);

  return (
    <div
      className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden hover:border-[#cbd5e1] transition-all"
      style={{ borderLeft: `3px solid ${risk.bar}` }}
    >
      <div className="px-4 py-3.5 space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[13px] font-semibold text-[#0f172a] leading-snug flex-1">{threat.threat}</p>
          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0", risk.style)}>
            {risk.label}
          </span>
        </div>
        {/* Likelihood + Impact row */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#94a3b8] font-medium">Likelihood</span>
          <span className={cn(
            "text-[10px] font-semibold px-1.5 py-0.5 rounded border",
            threat.likelihood === "High" ? "bg-red-50 text-red-600 border-red-200"
            : threat.likelihood === "Medium" ? "bg-amber-50 text-amber-600 border-amber-200"
            : "bg-[#f8fafc] text-[#64748b] border-[#e2e8f0]"
          )}>
            {threat.likelihood}
          </span>
          <span className="text-[#e2e8f0] text-xs">·</span>
          <span className="text-[10px] text-[#94a3b8] font-medium">Impact</span>
          <span className={cn(
            "text-[10px] font-semibold px-1.5 py-0.5 rounded border",
            threat.impact === "High" ? "bg-red-50 text-red-600 border-red-200"
            : threat.impact === "Medium" ? "bg-amber-50 text-amber-600 border-amber-200"
            : "bg-[#f8fafc] text-[#64748b] border-[#e2e8f0]"
          )}>
            {threat.impact}
          </span>
        </div>
        {/* Mitigation */}
        <div className="bg-[#f8fafc] border border-[#f1f5f9] rounded-lg px-3 py-2.5">
          <p className="text-[10px] text-[#94a3b8] font-semibold uppercase tracking-wider mb-1">Mitigation</p>
          <p className="text-[12px] text-[#374151] leading-relaxed">{threat.mitigation}</p>
        </div>
      </div>
    </div>
  );
}

// ── Recommendation item ───────────────────────────────────────────────────────

function RecommendationItem({ rec }: { rec: SecurityRecommendation }) {
  const pm = PRIORITY_META[rec.priority] ?? { badge: "bg-[#f8fafc] text-[#64748b] border-[#e2e8f0]", label: `P${rec.priority}` };
  const barColor = rec.priority === 1 ? "#ef4444" : rec.priority === 2 ? "#f59e0b" : "#6366f1";

  return (
    <div
      className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden hover:border-[#c7d2fe] transition-all"
      style={{ borderLeft: `3px solid ${barColor}` }}
    >
      <div className="px-4 py-3.5 space-y-2.5">
        <div className="flex items-start gap-3">
          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 mt-0.5", pm.badge)}>
            {pm.label}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-[#0f172a] leading-snug mb-0.5">{rec.title}</p>
            <p className="text-[12px] text-[#64748b] leading-relaxed">{rec.detail}</p>
          </div>
        </div>
        {rec.codeSnippet && (
          <div className="relative group/code">
            <pre className="text-[11.5px] text-[#334155] font-mono bg-[#f8fafc] border border-[#e2e8f0] rounded-lg px-4 py-3 overflow-auto max-h-44 leading-relaxed">
              {rec.codeSnippet}
            </pre>
            <div className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 transition-opacity">
              <CopyButton text={rec.codeSnippet} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <p className="text-[11px] text-[#64748b] uppercase tracking-wider font-bold shrink-0">{label}</p>
      <div className="flex-1 h-px bg-[#f1f5f9]" />
      <span className="text-[10px] text-[#94a3b8] bg-[#f1f5f9] rounded-full px-2 py-0.5 font-medium shrink-0">
        {count}
      </span>
    </div>
  );
}

// ── Generate state ────────────────────────────────────────────────────────────

function GenerateState({
  planId,
  onGenerated,
}: {
  planId: string;
  onGenerated: (review: SecurityReview) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/ai/security", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate");
      onGenerated(data.securityReview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="w-14 h-14 bg-white border border-[#e2e8f0] rounded-2xl flex items-center justify-center shadow-sm">
          <svg className="w-7 h-7 text-[#94a3b8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-[#0f172a]">Security Review</h3>
        <p className="text-[12px] text-[#64748b] max-w-xs leading-relaxed">
          AI-generated security checklist based on your plan&apos;s entities, APIs, and user flows
        </p>
      </div>
      {error && <p className="text-xs text-red-500 text-center max-w-xs">{error}</p>}
      <button
        onClick={generate}
        disabled={loading}
        className="flex items-center gap-2 px-5 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Analyzing your plan…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Generate Security Review
          </>
        )}
      </button>
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

interface Props {
  planId:        string;
  initialReview: SecurityReview | null;
  readOnly?:     boolean;
}

export function SecurityTab({ planId, initialReview, readOnly = false }: Props) {
  const [review,       setReview]       = useState<SecurityReview | null>(initialReview);
  const [regenerating, setRegenerating] = useState(false);
  const [regenError,   setRegenError]   = useState<string | null>(null);
  const [statusFilter,   setStatusFilter]   = useState<SecurityStatus | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<SecurityCategory | null>(null);

  const sorted = review
    ? [...review.checklist].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
    : [];

  // Present categories
  const presentCategories = useMemo(() => {
    const s = new Set<SecurityCategory>();
    sorted.forEach((i) => s.add(i.category));
    return Array.from(s);
  }, [sorted]);

  if (!review) {
    if (readOnly) return <div className="flex items-center justify-center h-full text-[#94a3b8] text-sm">No security review available</div>;
    return <GenerateState planId={planId} onGenerated={setReview} />;
  }

  // Counts per status for filter chips
  const statusCounts = sorted.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Filtered checklist
  const filtered = sorted.filter((item) => {
    const matchStatus   = !statusFilter   || item.status   === statusFilter;
    const matchCategory = !categoryFilter || item.category === categoryFilter;
    return matchStatus && matchCategory;
  });

  async function regenerate() {
    setRegenerating(true);
    setRegenError(null);
    try {
      const res  = await fetch("/api/ai/security", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to regenerate");
      setReview(data.securityReview);
      setStatusFilter(null);
      setCategoryFilter(null);
    } catch (err) {
      setRegenError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="p-6 overflow-y-auto h-full space-y-5">

      {/* Summary card (includes regenerate) */}
      <SummaryCard summary={review.summary} onRegenerate={regenerate} regenerating={regenerating} />

      {regenError && <p className="text-xs text-red-500">{regenError}</p>}

      {/* ── Checklist section ── */}
      <SectionHeader label="Security Checks" count={filtered.length} />

      {/* Filter bar */}
      <div className="space-y-2">
        {/* Status chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setStatusFilter(null)}
            className={cn(
              "text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all",
              !statusFilter
                ? "bg-[#0f172a] text-white border-[#0f172a]"
                : "bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#cbd5e1]"
            )}
          >
            All
          </button>
          {(["FAIL", "WARN", "PASS", "INFO"] as SecurityStatus[])
            .filter((s) => statusCounts[s] > 0)
            .map((s) => {
              const meta   = STATUS_META[s];
              const active = statusFilter === s;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(active ? null : s)}
                  className={cn(
                    "flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all",
                    active ? meta.badge : "bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#cbd5e1]"
                  )}
                >
                  {meta.label}
                  <span className={cn("text-[9px] px-1 py-px rounded-full font-semibold",
                    active ? "bg-white/60" : "bg-[#f1f5f9] text-[#94a3b8]"
                  )}>
                    {statusCounts[s]}
                  </span>
                </button>
              );
            })}
        </div>

        {/* Category chips */}
        {presentCategories.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setCategoryFilter(null)}
              className={cn(
                "text-[10px] font-medium px-2 py-0.5 rounded-full border transition-all",
                !categoryFilter
                  ? "bg-[#7C3AED]/10 text-[#7C3AED] border-[#7C3AED]/30"
                  : "bg-white text-[#94a3b8] border-[#e2e8f0] hover:border-[#cbd5e1]"
              )}
            >
              All categories
            </button>
            {presentCategories.map((cat) => {
              const active = categoryFilter === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(active ? null : cat)}
                  className={cn(
                    "text-[10px] font-medium px-2 py-0.5 rounded-full border transition-all",
                    active
                      ? CATEGORY_STYLES[cat]
                      : "bg-white text-[#94a3b8] border-[#e2e8f0] hover:border-[#cbd5e1] hover:text-[#64748b]"
                  )}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Checklist */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-[12px] text-[#94a3b8]">
            No checks match your filter
          </div>
        ) : (
          filtered.map((item) => <ChecklistItem key={item.id} item={item} />)
        )}
      </div>

      {/* ── Threat model section ── */}
      {review.threatModel.length > 0 && (
        <>
          <SectionHeader label="Threat Model" count={review.threatModel.length} />
          <div className="space-y-2.5">
            {review.threatModel.map((threat, i) => (
              <ThreatItem key={i} threat={threat} />
            ))}
          </div>
        </>
      )}

      {/* ── Recommendations section ── */}
      {review.recommendations.length > 0 && (
        <>
          <SectionHeader label="Recommendations" count={review.recommendations.length} />
          <div className="space-y-2.5">
            {review.recommendations.map((rec) => (
              <RecommendationItem key={rec.priority} rec={rec} />
            ))}
          </div>
        </>
      )}

      {/* Bottom padding */}
      <div className="h-4" />
    </div>
  );
}
