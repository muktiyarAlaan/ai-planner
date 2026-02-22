"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { formatRelativeDate } from "@/lib/utils";

interface Plan {
  id: string;
  title: string;
  model: string;
  rawRequirement: string;
  requirements?: { functional?: string[]; nonFunctional?: string[] } | null;
  entities?: { nodes?: unknown[] } | null;
  apiEndpoints?: unknown[] | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface Props {
  plans: Plan[];
  userName: string | null;
}

// ── Deterministic accent colour per plan ──────────────────────────────────────
const ACCENT_COLORS = [
  { bg: "#4f46e5", light: "#eef2ff" }, // indigo (brand)
  { bg: "#0ea5e9", light: "#e0f2fe" }, // sky
  { bg: "#10b981", light: "#d1fae5" }, // emerald
  { bg: "#f59e0b", light: "#fef3c7" }, // amber
  { bg: "#8b5cf6", light: "#ede9fe" }, // violet
  { bg: "#ec4899", light: "#fce7f3" }, // pink
  { bg: "#06b6d4", light: "#cffafe" }, // cyan
  { bg: "#f97316", light: "#ffedd5" }, // orange
];

function getAccent(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash * 31) + id.charCodeAt(i)) >>> 0;
  }
  return ACCENT_COLORS[hash % ACCENT_COLORS.length];
}

// ── Empty state ───────────────────────────────────────────────────────────────
const FEATURES = [
  {
    label: "Requirements",
    desc: "Functional & non-functional",
    path: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  },
  {
    label: "Entities & ERD",
    desc: "Database schema diagram",
    path: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4",
  },
  {
    label: "User Flows",
    desc: "Interactive flow canvas",
    path: "M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4",
  },
  {
    label: "API Specs",
    desc: "Endpoints with payloads",
    path: "M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  },
  {
    label: "Security Review",
    desc: "Threats & recommendations",
    path: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  },
  {
    label: "Context File",
    desc: "CLAUDE.md / .cursorrules",
    path: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
  },
];

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 bg-white border border-[#e2e8f0] rounded-2xl flex items-center justify-center mb-5 shadow-sm">
        <svg className="w-6 h-6 text-[#94a3b8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h2 className="text-base font-semibold text-[#0f172a] mb-2">No plans yet</h2>
      <p className="text-sm text-[#64748b] max-w-sm leading-relaxed">
        Describe a feature in plain English and get a fully structured engineering plan — instantly.
      </p>

      {/* Feature highlight grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-8 mb-8 max-w-lg w-full text-left">
        {FEATURES.map((f) => (
          <div key={f.label} className="bg-white border border-[#e2e8f0] rounded-xl p-3.5 flex items-start gap-2.5">
            <div className="w-6 h-6 bg-[#f1f5f9] rounded-lg flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-3.5 h-3.5 text-[#7C3AED]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={f.path} />
              </svg>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#374151] leading-tight">{f.label}</p>
              <p className="text-[10px] text-[#94a3b8] mt-0.5 leading-tight">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <Link
        href="/plans/new"
        className="flex items-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-medium text-sm px-5 py-2.5 rounded-lg transition-colors shadow-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
        Create your first plan
      </Link>
    </div>
  );
}

// ── Plan card ─────────────────────────────────────────────────────────────────
function PlanCard({ plan }: { plan: Plan }) {
  const accent = getAccent(plan.id);

  // Build a friendly model display: "gemini-2.0-flash-lite" → "⚡ gemini-2.0-flash-lite"
  const modelDisplay = plan.model.startsWith("gemini-") ? plan.model : `gemini-${plan.model}`;

  // One-line description from first functional requirement or rawRequirement
  const desc = (() => {
    const first = plan.requirements?.functional?.[0];
    const raw = first ?? plan.rawRequirement ?? "";
    return raw.length > 80 ? raw.slice(0, 80).trimEnd() + "…" : raw;
  })();

  // Entity and endpoint counts
  const entityCount = plan.entities?.nodes?.length ?? 0;
  const endpointCount = Array.isArray(plan.apiEndpoints) ? plan.apiEndpoints.length : 0;
  const hasStats = entityCount > 0 || endpointCount > 0;

  return (
    <Link href={`/plans/${plan.id}`}>
      <div className="group relative bg-white border border-[#e2e8f0] rounded-2xl overflow-hidden hover:border-[#7C3AED]/30 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col">

        {/* Coloured accent strip */}
        <div style={{ height: 4, background: accent.bg }} />

        <div className="p-5 flex flex-col flex-1">
          {/* Icon + chevron row */}
          <div className="flex items-start justify-between mb-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: accent.light }}
            >
              <svg className="w-4 h-4" style={{ color: accent.bg }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <svg
              className="w-4 h-4 text-[#cbd5e1] group-hover:text-[#7C3AED] transition-colors mt-1 shrink-0"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
            </svg>
          </div>

          {/* Title */}
          <h3 className="text-sm font-semibold text-[#0f172a] leading-snug group-hover:text-[#7C3AED] transition-colors line-clamp-2 mb-1.5">
            {plan.title}
          </h3>

          {/* One-line description */}
          {desc && (
            <p className="text-sm text-[#6B7280] line-clamp-1 mb-3 leading-relaxed flex-1">
              {desc}
            </p>
          )}

          {/* Footer */}
          <div className="pt-3 border-t border-[#f1f5f9] flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              {/* Model badge with lightning bolt */}
              <span className="text-[10px] text-[#64748b] font-mono bg-[#f8fafc] px-1.5 py-0.5 rounded border border-[#e2e8f0] flex items-center gap-1">
                <span>⚡</span>
                <span>{modelDisplay}</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Entity + endpoint counts */}
              {hasStats && (
                <span className="text-[10px] text-[#94a3b8]">
                  {entityCount > 0 && `${entityCount} entities`}
                  {entityCount > 0 && endpointCount > 0 && " · "}
                  {endpointCount > 0 && `${endpointCount} endpoints`}
                </span>
              )}
              <span className="flex items-center gap-1 text-[11px] text-[#94a3b8]">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatRelativeDate(plan.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Main client component ─────────────────────────────────────────────────────
export function DashboardPlans({ plans, userName }: Props) {
  const [search, setSearch] = useState("");

  const firstName = userName?.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const filtered = useMemo(
    () =>
      search.trim()
        ? plans.filter((p) => {
            const q = search.toLowerCase();
            return (
              p.title.toLowerCase().includes(q) ||
              (p.rawRequirement ?? "").toLowerCase().includes(q)
            );
          })
        : plans,
    [plans, search]
  );

  return (
    <div className="p-8 max-w-6xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-[11px] text-[#94a3b8] font-semibold uppercase tracking-widest mb-1">
            {greeting}
          </p>
          <h1 className="text-2xl font-bold text-[#0f172a] tracking-tight">
            {firstName}
          </h1>
          <p className="text-sm text-[#64748b] mt-1">
            {plans.length === 0
              ? "No plans yet — create your first one"
              : `${plans.length} plan${plans.length !== 1 ? "s" : ""} ready to implement`}
          </p>
        </div>
        <Link
          href="/plans/new"
          className="flex items-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-medium text-sm px-4 py-2.5 rounded-lg transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          New Plan
        </Link>
      </div>

      {plans.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* ── Search bar (shown when there are plans) ── */}
          <div className="relative mb-6 max-w-sm">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94a3b8] pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search plans…"
              className="w-full pl-8 pr-3 py-2 text-sm text-[#374151] bg-white border border-[#e2e8f0] rounded-lg focus:outline-none focus:border-[#7C3AED]/50 focus:ring-2 focus:ring-[#7C3AED]/10 placeholder:text-[#94a3b8] transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#64748b] transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* ── No search results ── */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-10 h-10 bg-[#f1f5f9] rounded-xl flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-[#94a3b8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-[#374151] mb-1">No plans match</p>
              <p className="text-xs text-[#94a3b8]">&ldquo;{search}&rdquo;</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((plan) => (
                <PlanCard key={plan.id} plan={plan} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
