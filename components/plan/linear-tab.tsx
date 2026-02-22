"use client";

import { useState } from "react";
import { LinearTicket } from "@/types/plan";
import { cn } from "@/lib/utils";

interface Props {
  planId: string;
  linearTickets: LinearTicket[] | null;
  hasLinearToken: boolean;
}

function LinearLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M.958 11.295a7.8 7.8 0 0 0 3.747 3.747L.958 11.295ZM.006 8.735l7.259 7.259a8.08 8.08 0 0 1-1.246.006L.006 8.735Zm0-1.44L9.44 16H8.03L0 7.97V7.295Zm1.24-3.056L11.87 14.76a7.9 7.9 0 0 1-1.44.96L1.2 6.176a7.9 7.9 0 0 1 .96-1.44h-.914Zm2.434-2.433L14.309 12.327a7.85 7.85 0 0 1-.914.96L2.681 2.572a7.85 7.85 0 0 1 .96-.914L3.68 2.806Zm2.88-1.473c.378.106.747.24 1.106.397L15.27 9.334a7.73 7.73 0 0 1-.397-1.106L6.56 1.333ZM9.12.248l6.632 6.632a7.8 7.8 0 0 0-3.747-3.747L9.12.248Z" />
    </svg>
  );
}

const TYPE_CONFIG = {
  Epic:  { bg: "bg-violet-50",  border: "border-violet-200", text: "text-violet-600",  dot: "bg-violet-400"  },
  Story: { bg: "bg-blue-50",    border: "border-blue-200",   text: "text-blue-600",    dot: "bg-blue-400"    },
  Task:  { bg: "bg-slate-50",   border: "border-slate-200",  text: "text-slate-500",   dot: "bg-slate-400"   },
} as const;

type TicketType = keyof typeof TYPE_CONFIG;

function countAll(tickets: LinearTicket[]): number {
  return tickets.reduce((sum, t) => sum + 1 + countAll(t.children ?? []), 0);
}

function IssueRow({
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
  const [open,    setOpen]    = useState(depth < 2);
  const [acOpen,  setAcOpen]  = useState(false);

  const hasChildren = (ticket.children?.length ?? 0) > 0;
  const hasCriteria = (ticket.acceptanceCriteria?.length ?? 0) > 0;
  const isSynced    = !!ticket.url;

  const type   = ticket.type in TYPE_CONFIG ? (ticket.type as TicketType) : "Task";
  const config = TYPE_CONFIG[type];

  const identifier = parentPrefix ? `${parentPrefix}-${index + 1}` : `${index + 1}`;

  return (
    <div>
      {/* Row */}
      <div className={cn(
        "group flex items-center gap-2 py-[7px] px-3 rounded-lg transition-colors",
        "hover:bg-[#f8fafc]",
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

        {/* Right badges */}
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

        {/* Always-visible type dot on non-hover */}
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

      {/* Children */}
      {open && hasChildren && (
        <div>
          {ticket.children!.map((child, i) => (
            <IssueRow key={i} ticket={child} depth={depth + 1} index={i} parentPrefix={identifier} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main tab ── */
export function LinearTab({ planId, linearTickets, hasLinearToken }: Props) {
  const [creating,    setCreating]    = useState(false);
  const [createError, setCreateError] = useState("");
  const [tickets,     setTickets]     = useState<LinearTicket[] | null>(linearTickets);

  const isSynced    = tickets?.some((t) => !!t.url) ?? false;
  const totalIssues = tickets ? countAll(tickets) : 0;

  const epics  = tickets?.filter((t) => t.type === "Epic")  ?? [];
  const others = tickets?.filter((t) => t.type !== "Epic")  ?? [];

  async function handleCreate() {
    if (!hasLinearToken) return;
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/linear/create-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed to create tickets");
      if (data.tickets) setTickets(data.tickets);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create tickets");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="h-full flex flex-col bg-white">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#e8eaf0] shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <LinearLogo className="w-4 h-4 text-[#5e6ad2] shrink-0" />
          <span className="text-[13px] font-semibold text-[#0f172a]">Issues</span>
          {totalIssues > 0 && (
            <span className="text-[11px] text-[#94a3b8] bg-[#f1f5f9] border border-[#e2e8f0] px-1.5 py-0.5 rounded-full font-medium">
              {totalIssues}
            </span>
          )}
          {isSynced && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full ml-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Synced
            </span>
          )}
        </div>

        {!hasLinearToken ? (
          <a href="/onboarding"
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#f8fafc] text-[#5e6ad2] border border-[#5e6ad2]/20 hover:bg-[#5e6ad2]/5 transition-colors">
            <LinearLogo className="w-3 h-3" />
            Connect Linear
          </a>
        ) : isSynced ? (
          <button onClick={handleCreate} disabled={creating}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#f8fafc] text-[#5e6ad2] border border-[#5e6ad2]/20 hover:bg-[#5e6ad2]/5 transition-colors disabled:opacity-50">
            {creating
              ? <div className="w-3 h-3 border border-[#5e6ad2]/30 border-t-[#5e6ad2] rounded-full animate-spin" />
              : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
            }
            {creating ? "Re-syncing…" : "Re-sync"}
          </button>
        ) : (
          <button onClick={handleCreate} disabled={creating || !tickets?.length}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#5e6ad2] hover:bg-[#4c58c0] text-white transition-colors disabled:opacity-50 shadow-sm">
            {creating
              ? <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
              : <LinearLogo className="w-3 h-3" />
            }
            {creating ? "Creating…" : "Create in Linear"}
          </button>
        )}
      </div>

      {/* Error banner */}
      {createError && (
        <div className="flex items-center gap-2 mx-4 mt-3 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg shrink-0">
          <svg className="w-3.5 h-3.5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-red-600 flex-1">{createError}</p>
          <button onClick={() => setCreateError("")} className="text-red-400 hover:text-red-600">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Issue list ── */}
      <div className="flex-1 overflow-y-auto">
        {!tickets?.length ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-16">
            <div className="w-10 h-10 bg-[#f1f5f9] rounded-xl flex items-center justify-center mb-3">
              <LinearLogo className="w-5 h-5 text-[#94a3b8]" />
            </div>
            <p className="text-sm font-medium text-[#475569] mb-1">No issues generated</p>
            <p className="text-xs text-[#94a3b8]">Generate a plan first to see issues here</p>
          </div>
        ) : (
          <div className="py-2 px-2">
            {/* After sync: single umbrella ticket — render directly without section headers */}
            {isSynced ? (
              tickets!.map((ticket, i) => (
                <IssueRow key={i} ticket={ticket} depth={0} index={i} />
              ))
            ) : (
              <>
                {epics.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 px-3 py-1.5 mt-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                      <span className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wider">
                        Epics · {epics.length}
                      </span>
                    </div>
                    {epics.map((ticket, i) => (
                      <IssueRow key={i} ticket={ticket} depth={0} index={i} />
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
                      <IssueRow key={i} ticket={ticket} depth={0} index={epics.length + i} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
