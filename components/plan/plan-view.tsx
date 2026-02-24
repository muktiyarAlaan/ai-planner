"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { PlanData } from "@/types/plan";
import { SessionUser } from "@/lib/get-session";
import { cn } from "@/lib/utils";
import { RequirementsTab } from "./requirements-tab";
import { EntitiesTab } from "./entities-tab";
import { UserFlowsTab } from "./user-flows-tab";
import { ApiTab } from "./api-tab";
import { ContextFileTab } from "./context-file-tab";
import { LinearTab } from "./linear-tab";
import { AiChatPanel } from "./ai-chat-panel";
import { SecurityTab } from "./security-tab";
import { ShareModal } from "./share-modal";
import { autoLayoutEntities } from "@/lib/erd-layout";

type Tab = "Requirements" | "Entities" | "User Flows" | "APIs" | "Security" | "Context" | "Linear";
const TABS: Tab[] = ["Requirements", "Entities", "User Flows", "APIs", "Security", "Context", "Linear"];

const CHAT_MIN     = 280;
const CHAT_MAX     = 600;
const CHAT_DEFAULT = 340;

// All sections the AI can patch in one response
export interface PlanPatch {
  entities?:      PlanData["entities"];
  userFlows?:     PlanData["userFlows"];
  requirements?:  PlanData["requirements"];
  apiEndpoints?:  PlanData["apiEndpoints"];
  contextMd?:     PlanData["contextMd"];
  linearTickets?: PlanData["linearTickets"];
}

interface Props {
  plan: PlanData;
  user: SessionUser;
}

function formatRelTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const CHAT_OPEN_KEY = "ai-panel-open";

export function PlanView({ plan, user }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("Requirements");
  const [chatOpen,  setChatOpen]  = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem(CHAT_OPEN_KEY);
    return stored === null ? true : stored === "1";
  });
  const [chatWidth, setChatWidth] = useState(CHAT_DEFAULT);
  const [shareOpen, setShareOpen] = useState(false);

  // Persist chat panel open/closed state
  useEffect(() => {
    localStorage.setItem(CHAT_OPEN_KEY, chatOpen ? "1" : "0");
  }, [chatOpen]);

  // ── Local plan state — AI patches are merged here ────────────────────────
  const [planData, setPlanData] = useState<PlanData>(plan);

  // ── Inline title editing ─────────────────────────────────────────────────
  const [editingTitle, setEditingTitle]   = useState(false);
  const [titleDraft,   setTitleDraft]     = useState(plan.title);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.focus();
  }, [editingTitle]);

  async function saveTitle() {
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === planData.title) {
      setEditingTitle(false);
      setTitleDraft(planData.title);
      return;
    }
    setEditingTitle(false);
    setPlanData((prev) => ({ ...prev, title: trimmed }));
    try {
      await fetch(`/api/plans/${planData.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ title: trimmed }),
      });
    } catch {
      // Silently fail — UI already updated optimistically
    }
  }

  // Version keys — incrementing forces a tab to remount with fresh initialProp
  const [entitiesKey,  setEntitiesKey]  = useState(0);
  const [userFlowsKey, setUserFlowsKey] = useState(0);
  const [contextKey,   setContextKey]   = useState(0);
  const [linearKey,    setLinearKey]    = useState(0);
  const [apiKey,       setApiKey]       = useState(0);

  // "Updated" indicator shown in the tab strip after an AI patch
  const [updatedTabs, setUpdatedTabs] = useState<Set<Tab>>(new Set());

  // Called by AiChatPanel whenever the API returns a non-null patch
  const onPlanUpdate = useCallback((patch: PlanPatch) => {
    let normalizedPatch = patch;
    if (patch.entities?.nodes?.length) {
      normalizedPatch = {
        ...patch,
        entities: {
          ...patch.entities,
          nodes: autoLayoutEntities(
            patch.entities.nodes as unknown as import("reactflow").Node[],
            (patch.entities.edges ?? []) as unknown as import("reactflow").Edge[],
          ) as unknown as NonNullable<PlanData["entities"]>["nodes"],
        },
      };
    }

    setPlanData((prev) => ({ ...prev, ...normalizedPatch }));

    // Force remount on canvas tabs so they pick up fresh data
    if (normalizedPatch.entities)      setEntitiesKey((k)  => k + 1);
    if (normalizedPatch.userFlows)     setUserFlowsKey((k) => k + 1);
    if (normalizedPatch.contextMd)     setContextKey((k)   => k + 1);
    if (normalizedPatch.linearTickets) setLinearKey((k)    => k + 1);
    if (normalizedPatch.apiEndpoints)  setApiKey((k)       => k + 1);

    // Light up the affected tabs with a green dot for 4 s
    const affected = new Set<Tab>();
    if (normalizedPatch.requirements)  affected.add("Requirements");
    if (normalizedPatch.entities)      affected.add("Entities");
    if (normalizedPatch.userFlows)     affected.add("User Flows");
    if (normalizedPatch.apiEndpoints)  affected.add("APIs");
    if (normalizedPatch.contextMd)     affected.add("Context");
    if (normalizedPatch.linearTickets) affected.add("Linear");
    setUpdatedTabs(affected);
    setTimeout(() => setUpdatedTabs(new Set()), 4000);
  }, []);

  const onEntitiesUpdate = useCallback((updatedEntities: PlanData["entities"]) => {
    setPlanData((prev) => ({ ...prev, entities: updatedEntities }));
  }, []);

  // ── Drag-to-resize chat panel ─────────────────────────────────────────────
  const isResizing  = useRef(false);
  const startX      = useRef(0);
  const startWidth  = useRef(0);

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    startX.current     = e.clientX;
    startWidth.current = chatWidth;
  }, [chatWidth]);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isResizing.current) return;
      const delta = startX.current - e.clientX;
      setChatWidth(Math.max(CHAT_MIN, Math.min(CHAT_MAX, startWidth.current + delta)));
    }
    function onMouseUp() { isResizing.current = false; }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup",   onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup",   onMouseUp);
    };
  }, []);

  // Computed stats for header
  const entityCount   = planData.entities?.nodes?.length ?? 0;
  const endpointCount = Array.isArray(planData.apiEndpoints) ? planData.apiEndpoints.length : 0;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f6fa]">

      {/* ── Share Modal ───────────────────────────────────────────────────── */}
      {shareOpen && (
        <ShareModal
          planId={planData.id}
          initialIsShared={planData.isShared ?? false}
          initialShareToken={planData.shareToken ?? null}
          onClose={() => setShareOpen(false)}
        />
      )}

      {/* ── Left: Plan content ─────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">

        {/* Plan header */}
        <div className="px-6 pt-4 pb-3 border-b border-[#e2e8f0] bg-white shrink-0">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-[#94a3b8] mb-2.5">
            <Link href="/plans" className="hover:text-[#64748b] transition-colors">Plans</Link>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-[#64748b] truncate max-w-[300px]">{planData.title}</span>
          </div>

          {/* Title row */}
          <div className="flex items-center justify-between gap-4">
            {/* Inline editable title */}
            <div className="flex-1 min-w-0">
              {editingTitle ? (
                <input
                  ref={titleInputRef}
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveTitle();
                    if (e.key === "Escape") {
                      setEditingTitle(false);
                      setTitleDraft(planData.title);
                    }
                  }}
                  className="w-full text-lg font-bold text-[#0f172a] bg-transparent border-b-2 border-[#7C3AED] outline-none tracking-tight"
                />
              ) : (
                <h1
                  className="text-lg font-bold text-[#0f172a] tracking-tight truncate cursor-text hover:text-[#7C3AED] transition-colors group flex items-center gap-2"
                  onClick={() => { setEditingTitle(true); setTitleDraft(planData.title); }}
                  title="Click to edit title"
                >
                  {planData.title}
                  <svg className="w-3.5 h-3.5 text-[#cbd5e1] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </h1>
              )}

              {/* Sub-line: creator info + stats */}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {user.name && (
                  <div className="flex items-center gap-1">
                    {user.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.image} alt={user.name} className="w-4 h-4 rounded-full" />
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-[#7C3AED]/20 flex items-center justify-center">
                        <span className="text-[8px] font-bold text-[#7C3AED]">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <span className="text-[11px] text-[#94a3b8]">{user.name}</span>
                  </div>
                )}
                <span className="text-[#e2e8f0] text-[10px]">·</span>
                <span className="text-[11px] text-[#94a3b8]">{formatRelTime(planData.createdAt)}</span>
                {(entityCount > 0 || endpointCount > 0) && (
                  <>
                    <span className="text-[#e2e8f0] text-[10px]">·</span>
                    <span className="text-[11px] text-[#94a3b8]">
                      {entityCount > 0 && `${entityCount} entities`}
                      {entityCount > 0 && endpointCount > 0 && " · "}
                      {endpointCount > 0 && `${endpointCount} endpoints`}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Model badge */}
              <span className="text-xs text-[#64748b] font-mono bg-[#f8fafc] border border-[#e2e8f0] px-1.5 py-0.5 rounded flex items-center gap-1">
                <span>⚡</span>
                <span>{planData.model}</span>
              </span>

              {/* Share button */}
              <button
                onClick={() => setShareOpen(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-[#64748b] hover:text-[#7C3AED] border border-[#e2e8f0] hover:border-[#7C3AED]/30 bg-white hover:bg-[#f5f3ff] px-2.5 py-1.5 rounded-lg transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share
              </button>

              {!chatOpen && (
                <button
                  onClick={() => setChatOpen(true)}
                  className="flex items-center gap-1.5 text-xs text-white bg-[#7C3AED] hover:bg-[#6D28D9] px-3 py-1.5 rounded-lg transition-colors font-medium shadow-sm"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  AI Chat
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tab nav — with green updated dot */}
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
              {/* Green "updated" pulse dot */}
              {updatedTabs.has(tab) && (
                <span className="absolute top-1.5 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden bg-[#f5f6fa]">
          {activeTab === "Requirements" && (
            <RequirementsTab
              requirements={planData.requirements}
              planId={planData.id}
              onUpdate={(reqs) => setPlanData((prev) => ({ ...prev, requirements: reqs }))}
            />
          )}
          {activeTab === "Entities" && (
            <EntitiesTab
              key={entitiesKey}
              entities={planData.entities}
              planId={planData.id}
              onUpdate={onEntitiesUpdate}
            />
          )}
          {activeTab === "User Flows" && (
            <UserFlowsTab
              key={userFlowsKey}
              userFlows={planData.userFlows}
              planId={planData.id}
              onUpdate={(flows) => setPlanData((prev) => ({ ...prev, userFlows: flows }))}
            />
          )}
          {activeTab === "APIs" && (
            <ApiTab
              key={apiKey}
              apiEndpoints={planData.apiEndpoints}
              planId={planData.id}
              onUpdate={(eps) => setPlanData((prev) => ({ ...prev, apiEndpoints: eps }))}
            />
          )}
          {activeTab === "Security" && (
            <SecurityTab planId={planData.id} initialReview={planData.securityReview} />
          )}
          {activeTab === "Context" && (
            <ContextFileTab
              key={contextKey}
              planId={planData.id}
              initialMarkdown={planData.contextMd}
              onUpdate={(md) => setPlanData((prev) => ({ ...prev, contextMd: md }))}
            />
          )}
          {activeTab === "Linear" && (
            <LinearTab
              key={linearKey}
              planId={planData.id}
              linearTickets={planData.linearTickets}
              hasLinearToken={user.hasLinearToken}
            />
          )}
        </div>
      </div>

      {/* ── Resize handle ───────────────────────────────────────────────────── */}
      {chatOpen && (
        <div
          onMouseDown={onResizeMouseDown}
          className="w-1 shrink-0 cursor-col-resize relative group z-20 bg-[#e2e8f0] hover:bg-[#7C3AED]/40 active:bg-[#7C3AED]/60 transition-colors"
          title="Drag to resize"
        >
          <div className="absolute inset-y-0 -left-2 -right-2" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-[3px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="w-[3px] h-[3px] rounded-full bg-[#7C3AED]" />
            <div className="w-[3px] h-[3px] rounded-full bg-[#7C3AED]" />
            <div className="w-[3px] h-[3px] rounded-full bg-[#7C3AED]" />
            <div className="w-[3px] h-[3px] rounded-full bg-[#7C3AED]" />
          </div>
        </div>
      )}

      {/* ── AI Chat (open) ─────────────────────────────────────────────────── */}
      {chatOpen && (
        <div
          style={{ width: chatWidth }}
          className="shrink-0 flex flex-col bg-white border-l border-[#e2e8f0] overflow-hidden"
        >
          <AiChatPanel
            planId={planData.id}
            onPlanUpdate={onPlanUpdate}
            onCollapse={() => setChatOpen(false)}
          />
        </div>
      )}

      {/* ── AI Chat (collapsed strip) ──────────────────────────────────────── */}
      {!chatOpen && (
        <div
          onClick={() => setChatOpen(true)}
          className="w-11 shrink-0 border-l border-[#e2e8f0] bg-white flex flex-col items-center py-5 gap-4 cursor-pointer hover:bg-[#f5f3ff] transition-colors group"
          title="Open AI Chat"
        >
          <div className="w-8 h-8 bg-[#7C3AED] group-hover:bg-[#6D28D9] rounded-xl flex items-center justify-center shadow-sm transition-colors">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span
            className="text-[10px] text-[#94a3b8] font-semibold tracking-widest uppercase group-hover:text-[#7C3AED] transition-colors"
            style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
          >
            AI Chat
          </span>
          <svg className="w-3.5 h-3.5 text-[#cbd5e1] group-hover:text-[#7C3AED] mt-auto transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </div>
      )}
    </div>
  );
}
