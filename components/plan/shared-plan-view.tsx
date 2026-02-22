"use client";

import { useState } from "react";
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
const METHOD_META: Record<string, { badge: string; bar: string }> = {
  GET:    { badge: "bg-blue-50 text-blue-600 border-blue-200",          bar: "#2563EB" },
  POST:   { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", bar: "#16A34A" },
  PUT:    { badge: "bg-amber-50 text-amber-700 border-amber-200",       bar: "#D97706" },
  DELETE: { badge: "bg-red-50 text-red-600 border-red-200",             bar: "#DC2626" },
  PATCH:  { badge: "bg-purple-50 text-purple-600 border-purple-200",    bar: "#7C3AED" },
};

function ReadOnlyApis({ apiEndpoints }: { apiEndpoints: ApiEndpoint[] | null }) {
  if (!apiEndpoints?.length) {
    return <div className="flex items-center justify-center h-full text-[#94a3b8] text-sm">No API endpoints</div>;
  }
  return (
    <div className="p-5 overflow-y-auto h-full space-y-2.5">
      {apiEndpoints.map((ep, i) => {
        const meta = METHOD_META[ep.method] ?? { badge: "bg-gray-50 text-gray-600 border-gray-200", bar: "#94a3b8" };
        return (
          <div key={i} className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden" style={{ borderLeft: `3px solid ${meta.bar}` }}>
            <div className="flex items-center gap-3.5 px-4 py-3.5">
              <span className={cn("text-[11px] font-bold font-mono px-2 py-0.5 rounded border shrink-0 text-center", meta.badge)} style={{ minWidth: 52 }}>
                {ep.method}
              </span>
              <div className="flex-1 min-w-0">
                <code className="text-[13px] text-[#0f172a] font-mono font-semibold">{ep.path}</code>
                <p className="text-[12px] text-[#64748b] mt-0.5 line-clamp-1">{ep.description}</p>
              </div>
              {ep.auth ? (
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md shrink-0">Auth</span>
              ) : (
                <span className="text-[10px] text-[#94a3b8] bg-[#f8fafc] border border-[#e2e8f0] px-1.5 py-0.5 rounded-md shrink-0">Public</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Read-only Linear ──────────────────────────────────────────────────────────
function ReadOnlyLinear({ linearTickets }: { linearTickets: LinearTicket[] | null }) {
  if (!linearTickets?.length) {
    return <div className="flex items-center justify-center h-full text-[#94a3b8] text-sm">No Linear tickets</div>;
  }

  function TicketRow({ ticket, depth = 0 }: { ticket: LinearTicket; depth?: number }) {
    const [open, setOpen] = useState(depth < 2);
    const hasChildren = (ticket.children?.length ?? 0) > 0;
    const isSynced = !!ticket.url;
    const typeColors = { Epic: "text-violet-600 bg-violet-50 border-violet-200", Story: "text-blue-600 bg-blue-50 border-blue-200", Task: "text-slate-500 bg-slate-50 border-slate-200" };
    const typeStyle = typeColors[ticket.type as keyof typeof typeColors] ?? typeColors.Task;

    return (
      <div>
        <div className={cn("flex items-center gap-2 py-[7px] px-3 rounded-lg hover:bg-[#f8fafc]", depth > 0 && "ml-5")}>
          <button className={cn("w-4 h-4 flex items-center justify-center shrink-0", hasChildren ? "text-[#94a3b8]" : "invisible")} onClick={() => setOpen((o) => !o)}>
            <svg className={cn("w-3 h-3 transition-transform", open ? "rotate-90" : "")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <span className="text-[13px] text-[#1e293b] font-medium flex-1 truncate">{ticket.title}</span>
          {isSynced && ticket.url ? (
            <a href={ticket.url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 text-[#5e6ad2] bg-[#f0f1fe] border-[#c7d2fe]">
              View ↗
            </a>
          ) : (
            <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0", typeStyle)}>{ticket.type}</span>
          )}
        </div>
        {open && hasChildren && (
          <div>{ticket.children!.map((child, i) => <TicketRow key={i} ticket={child} depth={depth + 1} />)}</div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-white p-3">
      {linearTickets.map((t, i) => <TicketRow key={i} ticket={t} />)}
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
