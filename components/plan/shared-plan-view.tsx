"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { PlanData, PlanRequirements, ApiEndpoint, LinearTicket } from "@/types/plan";
import { cn } from "@/lib/utils";
import { EntitiesTab } from "./entities-tab";
import { UserFlowsTab } from "./user-flows-tab";
import { SecurityTab } from "./security-tab";
import { ContextFileTab } from "./context-file-tab";

type Tab = "Requirements" | "Entities" | "User Flows" | "APIs" | "Security" | "Context" | "Linear";
const TABS: Tab[] = ["Requirements", "Entities", "User Flows", "APIs", "Security", "Context", "Linear"];

// ── Read-only Requirements ────────────────────────────────────────────────────
function ReadOnlyRequirements({ requirements }: { requirements: PlanRequirements | null }) {
  if (!requirements) {
    return <div className="flex items-center justify-center h-full text-[#94a3b8] text-sm">No requirements</div>;
  }
  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5">
          <h3 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-3">Functional Requirements</h3>
          <div className="space-y-2.5">
            {(requirements.functional ?? []).map((req, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-4 h-4 rounded border border-[#e2e8f0] bg-[#f8fafc] mt-0.5 shrink-0 flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-[#7C3AED]" fill="none" stroke="currentColor" viewBox="0 0 12 12">
                    <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="text-sm text-[#374151] leading-relaxed">{req}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5">
          <h3 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-3">Non-Functional Requirements</h3>
          <div className="space-y-2.5">
            {(requirements.nonFunctional ?? []).map((req, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-4 h-4 rounded border border-[#e2e8f0] bg-[#f8fafc] mt-0.5 shrink-0" />
                <span className="text-sm text-[#374151] leading-relaxed">{req}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {(requirements.outOfScope ?? []).length > 0 && (
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5">
          <h3 className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-3">Out of Scope</h3>
          <div className="space-y-1.5">
            {requirements.outOfScope.map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="text-[#94a3b8] text-sm mt-0.5">—</span>
                <span className="text-sm text-[#94a3b8] leading-relaxed line-through decoration-[#cbd5e1]">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Read-only API ─────────────────────────────────────────────────────────────
const METHOD_META: Record<string, { badge: string; bar: string; filter: string }> = {
  GET:    { badge: "bg-blue-50 text-blue-600 border-blue-200",          bar: "#2563EB", filter: "bg-blue-50 text-blue-600 border-blue-300"     },
  POST:   { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", bar: "#16A34A", filter: "bg-emerald-50 text-emerald-700 border-emerald-300" },
  PUT:    { badge: "bg-amber-50 text-amber-700 border-amber-200",       bar: "#D97706", filter: "bg-amber-50 text-amber-700 border-amber-300"   },
  DELETE: { badge: "bg-red-50 text-red-600 border-red-200",             bar: "#DC2626", filter: "bg-red-50 text-red-600 border-red-300"         },
  PATCH:  { badge: "bg-purple-50 text-purple-600 border-purple-200",    bar: "#7C3AED", filter: "bg-purple-50 text-purple-600 border-purple-300" },
};
const FALLBACK_META = { badge: "bg-gray-50 text-gray-600 border-gray-200", bar: "#94a3b8", filter: "bg-gray-50 text-gray-600 border-gray-300" };

function JsonBlock({ json }: { json: Record<string, unknown> }) {
  return (
    <pre className="text-[11.5px] text-[#334155] font-mono bg-white border border-[#e2e8f0] rounded-lg px-4 py-3.5 overflow-auto max-h-48 leading-relaxed">
      {JSON.stringify(json, null, 2)}
    </pre>
  );
}

function ROEndpointCard({ endpoint }: { endpoint: ApiEndpoint }) {
  const [expanded, setExpanded] = useState(false);
  const [bodyTab, setBodyTab]   = useState<"request" | "response">("request");

  const meta        = METHOD_META[endpoint.method] ?? FALLBACK_META;
  const hasRequest  = !!endpoint.requestBody;
  const hasResponse = !!endpoint.responseBody;
  const hasBoth     = hasRequest && hasResponse;
  const hasBody     = hasRequest || hasResponse;
  const activeBodyTab: "request" | "response" = hasBoth ? bodyTab : hasRequest ? "request" : "response";

  return (
    <div
      className={cn(
        "bg-white rounded-xl overflow-hidden transition-all duration-200",
        expanded ? "border border-[#c7d2fe] shadow-sm" : "border border-[#e2e8f0] hover:border-[#7C3AED]/30 hover:shadow-sm"
      )}
      style={{ borderLeft: `3px solid ${meta.bar}` }}
    >
      <div className="flex items-center gap-3.5 px-4 py-3.5">
        <span className={cn("text-[11px] font-bold font-mono px-2 py-0.5 rounded border shrink-0 text-center", meta.badge)} style={{ minWidth: 52 }}>
          {endpoint.method}
        </span>

        <div
          className={cn("flex-1 min-w-0", hasBody && "cursor-pointer select-none")}
          onClick={() => hasBody && setExpanded((v) => !v)}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-[13px] text-[#0f172a] font-mono font-semibold tracking-tight">{endpoint.path}</code>
            {endpoint.auth ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                <svg className="w-2.5 h-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Auth
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] text-[#94a3b8] bg-[#f8fafc] border border-[#e2e8f0] px-1.5 py-0.5 rounded-md">
                <svg className="w-2.5 h-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
                Public
              </span>
            )}
          </div>
          <p className="text-[12px] text-[#64748b] mt-0.5 leading-relaxed line-clamp-1">{endpoint.description}</p>
        </div>

        {hasBody && (
          <svg
            className={cn("w-4 h-4 shrink-0 transition-all duration-200 cursor-pointer", expanded ? "rotate-180 text-[#7C3AED]" : "text-[#cbd5e1]")}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
            onClick={() => setExpanded((v) => !v)}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </div>

      {expanded && hasBody && (
        <div className="border-t border-[#eef0f8] bg-[#fafbfe]">
          {hasBoth ? (
            <>
              <div className="flex items-center border-b border-[#eef0f8] px-4">
                {(["request", "response"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={(e) => { e.stopPropagation(); setBodyTab(t); }}
                    className={cn(
                      "text-[11px] font-semibold py-2.5 px-1 mr-5 border-b-2 -mb-px transition-colors capitalize",
                      activeBodyTab === t ? "text-[#7C3AED] border-[#7C3AED]" : "text-[#94a3b8] border-transparent hover:text-[#64748b]"
                    )}
                  >
                    {t === "request" ? "Request Body" : "Response Body"}
                  </button>
                ))}
              </div>
              <div className="p-4">
                {activeBodyTab === "request"  && endpoint.requestBody  && <JsonBlock json={endpoint.requestBody} />}
                {activeBodyTab === "response" && endpoint.responseBody && <JsonBlock json={endpoint.responseBody} />}
              </div>
            </>
          ) : (
            <div className="p-4">
              {hasRequest  && endpoint.requestBody  && (<><p className="text-[10px] text-[#94a3b8] uppercase tracking-wider font-semibold mb-2">Request Body</p><JsonBlock json={endpoint.requestBody} /></>)}
              {hasResponse && endpoint.responseBody && (<><p className="text-[10px] text-[#94a3b8] uppercase tracking-wider font-semibold mb-2">Response Body</p><JsonBlock json={endpoint.responseBody} /></>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReadOnlyApis({ apiEndpoints }: { apiEndpoints: ApiEndpoint[] | null }) {
  const endpoints = apiEndpoints ?? [];
  const [search,       setSearch]       = useState("");
  const [methodFilter, setMethodFilter] = useState<string | null>(null);

  const presentMethods = useMemo(() => {
    const s = new Set<string>();
    endpoints.forEach((e) => s.add(e.method));
    return Array.from(s).sort();
  }, [endpoints]);

  const methodCounts = useMemo(
    () => endpoints.reduce((acc, e) => { acc[e.method] = (acc[e.method] ?? 0) + 1; return acc; }, {} as Record<string, number>),
    [endpoints]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return endpoints.filter((ep) => {
      const matchesMethod = !methodFilter || ep.method === methodFilter;
      const matchesSearch = !q || ep.path.toLowerCase().includes(q) || ep.description?.toLowerCase().includes(q) || ep.method.toLowerCase().includes(q);
      return matchesMethod && matchesSearch;
    });
  }, [endpoints, methodFilter, search]);

  if (!endpoints.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <div className="w-12 h-12 bg-[#f1f5f9] rounded-2xl flex items-center justify-center">
          <svg className="w-5 h-5 text-[#94a3b8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-[13px] font-medium text-[#64748b]">No API endpoints</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="px-5 pt-4 pb-3 border-b border-[#e2e8f0] bg-white shrink-0 space-y-3">
        <div className="flex items-center gap-3">
          <p className="text-[12px] text-[#64748b] font-medium shrink-0">
            <span className="text-[#0f172a] font-bold text-[15px]">{endpoints.length}</span>
            {" "}endpoint{endpoints.length !== 1 ? "s" : ""}
          </p>
          <div className="flex-1 relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94a3b8] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1116.65 16.65z" />
            </svg>
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by path, method, or description…"
              className="w-full bg-[#f8fafc] border border-[#e2e8f0] rounded-lg pl-8 pr-3 py-1.5 text-[12px] text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]/20 transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setMethodFilter(null)}
            className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all",
              !methodFilter ? "bg-[#0f172a] text-white border-[#0f172a]" : "bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#cbd5e1] hover:text-[#374151]")}
          >All</button>
          {presentMethods.map((method) => {
            const meta   = METHOD_META[method] ?? FALLBACK_META;
            const active = methodFilter === method;
            return (
              <button
                key={method}
                onClick={() => setMethodFilter(active ? null : method)}
                className={cn("flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all",
                  active ? cn(meta.filter, "ring-1 ring-offset-0") : "bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#cbd5e1] hover:text-[#374151]")}
              >
                {method}
                <span className={cn("text-[9px] font-semibold px-1 py-px rounded-full", active ? "bg-white/60" : "bg-[#f1f5f9] text-[#94a3b8]")}>
                  {methodCounts[method]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Endpoint list */}
      <div className="flex-1 overflow-y-auto p-5 space-y-2.5">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-[12px] text-[#94a3b8]">No endpoints match your filter</div>
        ) : (
          filtered.map((ep, i) => <ROEndpointCard key={`${ep.method}-${ep.path}-${i}`} endpoint={ep} />)
        )}
      </div>
    </div>
  );
}

// ── Read-only Linear ──────────────────────────────────────────────────────────
function LinearLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M.958 11.295a7.8 7.8 0 0 0 3.747 3.747L.958 11.295ZM.006 8.735l7.259 7.259a8.08 8.08 0 0 1-1.246.006L.006 8.735Zm0-1.44L9.44 16H8.03L0 7.97V7.295Zm1.24-3.056L11.87 14.76a7.9 7.9 0 0 1-1.44.96L1.2 6.176a7.9 7.9 0 0 1 .96-1.44h-.914Zm2.434-2.433L14.309 12.327a7.85 7.85 0 0 1-.914.96L2.681 2.572a7.85 7.85 0 0 1 .96-.914L3.68 2.806Zm2.88-1.473c.378.106.747.24 1.106.397L15.27 9.334a7.73 7.73 0 0 1-.397-1.106L6.56 1.333ZM9.12.248l6.632 6.632a7.8 7.8 0 0 0-3.747-3.747L9.12.248Z" />
    </svg>
  );
}

const RO_TYPE_CONFIG = {
  Epic:  { bg: "bg-violet-50",  border: "border-violet-200", text: "text-violet-600",  dot: "bg-violet-400"  },
  Story: { bg: "bg-blue-50",    border: "border-blue-200",   text: "text-blue-600",    dot: "bg-blue-400"    },
  Task:  { bg: "bg-slate-50",   border: "border-slate-200",  text: "text-slate-500",   dot: "bg-slate-400"   },
} as const;

type ROTicketType = keyof typeof RO_TYPE_CONFIG;

function countAllTickets(tickets: LinearTicket[]): number {
  return tickets.reduce((sum, t) => sum + 1 + countAllTickets(t.children ?? []), 0);
}

function ROIssueRow({
  ticket,
  depth = 0,
  index,
  parentPrefix = "",
}: {
  ticket: LinearTicket;
  depth?: number;
  index: number;
  parentPrefix?: string;
}) {
  const [open, setOpen] = useState(depth < 2);
  const [acOpen, setAcOpen] = useState(false);
  const hasChildren = (ticket.children?.length ?? 0) > 0;
  const hasCriteria = (ticket.acceptanceCriteria?.length ?? 0) > 0;
  const isSynced = !!ticket.url;
  const type = ticket.type in RO_TYPE_CONFIG ? (ticket.type as ROTicketType) : "Task";
  const config = RO_TYPE_CONFIG[type];
  const identifier = parentPrefix ? `${parentPrefix}-${index + 1}` : `${index + 1}`;

  return (
    <div>
      <div className={cn(
        "group flex items-center gap-2 py-[7px] px-3 rounded-lg transition-colors hover:bg-[#f8fafc]",
        depth > 0 && "ml-5",
      )}>
        {/* Chevron */}
        <button
          className={cn(
            "w-4 h-4 flex items-center justify-center shrink-0 rounded transition-colors",
            hasChildren ? "text-[#94a3b8] hover:text-[#475569] hover:bg-[#f1f5f9]" : "invisible"
          )}
          onClick={() => setOpen((o) => !o)}
        >
          <svg className={cn("w-3 h-3 transition-transform", open ? "rotate-90" : "")}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Type dot */}
        <div className={cn("w-2 h-2 rounded-full shrink-0", config.dot)} />

        {/* Identifier */}
        {isSynced ? (
          <a href={ticket.url} target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[11px] font-mono text-[#5e6ad2] hover:underline underline-offset-2 shrink-0">
            #{identifier}
          </a>
        ) : (
          <span className="text-[11px] font-mono text-[#d1d5db] shrink-0">#{identifier}</span>
        )}

        {/* Title */}
        <span className="text-[13px] text-[#1e293b] font-medium flex-1 min-w-0 truncate">
          {ticket.title}
        </span>

        {/* Right badges — hover */}
        <div className="flex items-center gap-1.5 shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className={cn(
            "text-[10px] font-semibold px-1.5 py-0.5 rounded border",
            config.bg, config.border, config.text
          )}>
            {ticket.type}
          </span>
          {hasCriteria && (
            <button
              onClick={() => setAcOpen((o) => !o)}
              className={cn(
                "flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors",
                acOpen
                  ? "bg-[#5e6ad2]/10 text-[#5e6ad2]"
                  : "text-[#94a3b8] hover:text-[#64748b] hover:bg-[#f1f5f9]"
              )}
              title="Acceptance criteria"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              {ticket.acceptanceCriteria.length}
            </button>
          )}
          {isSynced && (
            <a href={ticket.url} target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[#c7d2fe] hover:text-[#5e6ad2] transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>

        {/* Always-visible type badge on non-hover */}
        <div className="group-hover:hidden flex items-center gap-1.5 shrink-0 ml-2">
          <span className={cn(
            "text-[10px] font-semibold px-1.5 py-0.5 rounded border",
            config.bg, config.border, config.text
          )}>
            {ticket.type}
          </span>
        </div>
      </div>

      {/* Acceptance criteria */}
      {acOpen && hasCriteria && (
        <div className={cn(
          "mx-3 mb-1 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5",
          depth > 0 && "ml-8"
        )}>
          <p className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wider mb-2">
            Acceptance Criteria
          </p>
          <div className="space-y-1.5">
            {ticket.acceptanceCriteria.map((ac, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-3.5 h-3.5 rounded border border-[#cbd5e1] bg-white shrink-0 mt-0.5" />
                <span className="text-xs text-[#475569] leading-relaxed">{ac}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {open && hasChildren && (
        <div>
          {ticket.children!.map((child, i) => (
            <ROIssueRow key={i} ticket={child} depth={depth + 1} index={i} parentPrefix={identifier} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReadOnlyLinear({ linearTickets }: { linearTickets: LinearTicket[] | null }) {
  const totalIssues = linearTickets ? countAllTickets(linearTickets) : 0;
  const epics  = linearTickets?.filter((t) => t.type === "Epic")  ?? [];
  const others = linearTickets?.filter((t) => t.type !== "Epic")  ?? [];

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#e8eaf0] shrink-0">
        <LinearLogo className="w-4 h-4 text-[#5e6ad2] shrink-0" />
        <span className="text-[13px] font-semibold text-[#0f172a]">Issues</span>
        {totalIssues > 0 && (
          <span className="text-[11px] text-[#94a3b8] bg-[#f1f5f9] border border-[#e2e8f0] px-1.5 py-0.5 rounded-full font-medium">
            {totalIssues}
          </span>
        )}
      </div>

      {/* Issue list */}
      <div className="flex-1 overflow-y-auto">
        {!linearTickets?.length ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-16">
            <div className="w-10 h-10 bg-[#f1f5f9] rounded-xl flex items-center justify-center mb-3">
              <LinearLogo className="w-5 h-5 text-[#94a3b8]" />
            </div>
            <p className="text-sm font-medium text-[#475569] mb-1">No issues generated</p>
            <p className="text-xs text-[#94a3b8]">Generate a plan first to see issues here</p>
          </div>
        ) : (
          <div className="py-2 px-2">
            {epics.length > 0 && (
              <>
                <div className="flex items-center gap-2 px-3 py-1.5 mt-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                  <span className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wider">
                    Epics · {epics.length}
                  </span>
                </div>
                {epics.map((ticket, i) => (
                  <ROIssueRow key={i} ticket={ticket} depth={0} index={i} />
                ))}
              </>
            )}
            {others.length > 0 && (
              <div className={cn(epics.length > 0 && "mt-2 pt-2 border-t border-[#f1f5f9]")}>
                <div className="flex items-center gap-2 px-3 py-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wider">
                    Issues · {others.length}
                  </span>
                </div>
                {others.map((ticket, i) => (
                  <ROIssueRow key={i} ticket={ticket} depth={0} index={epics.length + i} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main shared view ──────────────────────────────────────────────────────────
interface Props {
  plan: PlanData;
}

export function SharedPlanView({ plan }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("Requirements");

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#f5f6fa]">

      {/* Shared banner */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-[#0f172a] text-white shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-[#7C3AED] rounded flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="text-[12px] font-medium text-[#94a3b8]">Viewing shared plan from Alaan Planner</span>
          <span className="text-[#475569] text-[12px]">·</span>
          <span className="text-[12px] font-semibold text-white truncate max-w-[300px]">{plan.title}</span>
        </div>
        <Link
          href="/login"
          className="flex items-center gap-1.5 text-[11px] font-medium text-white bg-[#7C3AED] hover:bg-[#6D28D9] px-3 py-1.5 rounded-lg transition-colors"
        >
          Create your own plan →
        </Link>
      </div>

      {/* Plan header */}
      <div className="px-6 pt-4 pb-3 border-b border-[#e2e8f0] bg-white shrink-0">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-lg font-bold text-[#0f172a] tracking-tight">{plan.title}</h1>
          <span className="text-xs text-[#64748b] font-mono bg-[#f8fafc] border border-[#e2e8f0] px-1.5 py-0.5 rounded flex items-center gap-1">
            <span>⚡</span>
            <span>{plan.model}</span>
          </span>
        </div>
        {plan.rawRequirement && (
          <p className="text-sm text-[#6B7280] mt-1 line-clamp-2 leading-relaxed">{plan.rawRequirement}</p>
        )}
      </div>

      {/* Tab nav */}
      <div className="flex border-b border-[#e2e8f0] bg-white shrink-0 px-2">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "relative px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px whitespace-nowrap",
              activeTab === tab
                ? "text-[#7C3AED] border-[#7C3AED]"
                : "text-[#64748b] border-transparent hover:text-[#374151] hover:border-[#cbd5e1]"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden bg-[#f5f6fa]">
        {activeTab === "Requirements" && <ReadOnlyRequirements requirements={plan.requirements} />}
        {activeTab === "Entities" && <EntitiesTab entities={plan.entities} readOnly />}
        {activeTab === "User Flows" && (
          <UserFlowsTab
            userFlows={plan.userFlows}
            planId={plan.id}
            onUpdate={() => {}}
            readOnly
          />
        )}
        {activeTab === "APIs" && <ReadOnlyApis apiEndpoints={plan.apiEndpoints} />}
        {activeTab === "Security" && (
          <SecurityTab planId={plan.id} initialReview={plan.securityReview} readOnly />
        )}
        {activeTab === "Context" && (
          <ContextFileTab planId={plan.id} initialMarkdown={plan.contextMd} readOnly />
        )}
        {activeTab === "Linear" && <ReadOnlyLinear linearTickets={plan.linearTickets} />}
      </div>
    </div>
  );
}
