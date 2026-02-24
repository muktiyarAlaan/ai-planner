"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { PlanPatch } from "./plan-view";

// ── Types ──────────────────────────────────────────────────────────────────

interface ProposalRelatedChange {
  changeType:    "add" | "update" | "verify" | "delete";
  description:   string;
  targetSection?: string;
  targetName?:   string;
}

interface Proposal {
  primaryChange: {
    changeType:  "new" | "modified" | "deleted";
    section:     string;
    name:        string;
    description: string;
    fieldCount?: number;
  };
  relatedChanges:   ProposalRelatedChange[];
  affectedSections: string[];
}

interface Message {
  role:         "user" | "assistant";
  content:      string;
  id:           number;
  timestamp:    string;      // ISO string
  patched?:     boolean;
  sections?:    string;
  showActions?: boolean;    // legacy fallback — true when AI proposes a change
  proposal?:    Proposal;   // structured proposal card (replaces showActions)
  isError?:     boolean;    // true for error messages
}

interface Props {
  planId:        string;
  onCollapse:    () => void;
  onPlanUpdate?: (patch: PlanPatch) => void;
}

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_CHIPS = [
  "What's missing from this plan?",
  "Review the security model",
  "Suggest improvements",
  "Explain the user flow step by step",
];

const STORAGE_KEY    = (id: string) => `ai-chat-${id}`;
const NOTE_DISM_KEY  = (id: string) => `ai-chat-note-${id}`;
const MAX_STORED     = 60;

// ── Markdown renderer ──────────────────────────────────────────────────────
// Handles: ## headers, **bold**, `code`, bullet lists, numbered lists, paragraphs

function renderMarkdown(text: string): string {
  const lines   = text.split("\n");
  const result: string[] = [];
  let inUl      = false;
  let inOl      = false;
  let paraLines: string[] = [];

  function flushPara() {
    if (paraLines.length) {
      result.push(`<p class="md-p">${paraLines.join(" ")}</p>`);
      paraLines = [];
    }
  }

  function closeList() {
    if (inUl) { result.push("</ul>"); inUl = false; }
    if (inOl) { result.push("</ol>"); inOl = false; }
  }

  function processInline(s: string): string {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g,     "<em>$1</em>")
      .replace(/`(.+?)`/g,       '<code class="md-code">$1</code>');
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushPara();
      closeList();
      continue;
    }

    // ## / # Section header → small all-caps gray label
    if (/^#{1,3} /.test(trimmed)) {
      flushPara(); closeList();
      const hText = trimmed.replace(/^#{1,3} /, "");
      result.push(`<div class="md-h">${processInline(hText)}</div>`);
      continue;
    }

    // Bullet list
    const bulletMatch = trimmed.match(/^[-*•] (.+)/);
    if (bulletMatch) {
      flushPara();
      if (inOl) { result.push("</ol>"); inOl = false; }
      if (!inUl) { result.push('<ul class="md-ul">'); inUl = true; }
      result.push(`<li>${processInline(bulletMatch[1])}</li>`);
      continue;
    }

    // Numbered list
    const olMatch = trimmed.match(/^\d+\. (.+)/);
    if (olMatch) {
      flushPara();
      if (inUl) { result.push("</ul>"); inUl = false; }
      if (!inOl) { result.push('<ol class="md-ol">'); inOl = true; }
      result.push(`<li>${processInline(olMatch[1])}</li>`);
      continue;
    }

    if (inUl || inOl) { closeList(); }
    paraLines.push(processInline(trimmed));
  }

  flushPara();
  closeList();
  return result.join("");
}

// ── Proposal detection ─────────────────────────────────────────────────────

function hasProposal(content: string): boolean {
  const lower = content.toLowerCase();
  return [
    "i can update", "i can add", "i can change", "i can modify",
    "want me to apply", "want me to add", "want me to update",
    "shall i add", "shall i update", "shall i change",
    "i'll change", "i'll add", "i'll update", "i'll modify",
    "should i add", "would you like me to",
    "i could add", "i could update", "i could change",
  ].some((p) => lower.includes(p));
}

// ── Proposal Card ──────────────────────────────────────────────────────────

const SECTION_LABELS: Record<string, string> = {
  entities:      "Entities",
  userFlows:     "User Flows",
  apiEndpoints:  "API Design",
  requirements:  "Requirements",
  contextMd:     "Context",
  linearTickets: "Linear Tickets",
};

const SECTION_BADGE: Record<string, string> = {
  entities:      "bg-purple-100 text-purple-700",
  userFlows:     "bg-cyan-100 text-cyan-700",
  apiEndpoints:  "bg-blue-100 text-blue-700",
  requirements:  "bg-emerald-100 text-emerald-700",
  contextMd:     "bg-gray-100 text-gray-600",
  linearTickets: "bg-orange-100 text-orange-700",
};

function ProposalCard({
  proposal,
  onApply,
  onCancel,
}: {
  proposal: Proposal;
  onApply:  () => void;
  onCancel: () => void;
}) {
  const { primaryChange, relatedChanges, affectedSections } = proposal;

  const primaryBadge =
    primaryChange.changeType === "new"      ? { label: "New",      cls: "bg-emerald-100 text-emerald-700" } :
    primaryChange.changeType === "modified" ? { label: "Modified",  cls: "bg-blue-100 text-blue-700" }     :
                                              { label: "Removed",   cls: "bg-red-100 text-red-600" };

  function RelatedIcon({ type }: { type: ProposalRelatedChange["changeType"] }) {
    if (type === "add")    return <span className="font-bold text-emerald-600 shrink-0 w-3 text-center">+</span>;
    if (type === "delete") return <span className="font-bold text-red-500    shrink-0 w-3 text-center">−</span>;
    if (type === "verify") return (
      <svg className="w-3 h-3 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" strokeWidth={2} />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
      </svg>
    );
    // update
    return (
      <svg className="w-3 h-3 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-[#E5E7EB] overflow-hidden bg-white shadow-sm">

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#E5E7EB] bg-[#FAFAFA]">
        <div className="w-5 h-5 rounded-md bg-[#7C3AED]/10 flex items-center justify-center shrink-0">
          <svg className="w-2.5 h-2.5 text-[#7C3AED]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        <p className="flex-1 text-[11px] font-semibold text-[#111827]">Confirm Change</p>
        <span className="text-[10px] text-gray-400 font-medium">
          {SECTION_LABELS[primaryChange.section] ?? primaryChange.section}
        </span>
      </div>

      {/* Primary change */}
      <div className="px-3 pt-2.5 pb-2">
        <div className="bg-[#F9FAFB] rounded-lg p-2.5 border border-[#E5E7EB]">
          <span className={`inline-block text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded mb-1.5 ${primaryBadge.cls}`}>
            {primaryBadge.label}
          </span>
          <p className="text-[12px] font-semibold text-[#111827] leading-tight">{primaryChange.name}</p>
          <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
            {primaryChange.description}
            {primaryChange.fieldCount != null ? ` (${primaryChange.fieldCount} fields)` : ""}
          </p>
        </div>
      </div>

      {/* Related changes */}
      {relatedChanges.length > 0 && (
        <div className="px-3 pb-2">
          <div className="border border-emerald-200 bg-emerald-50/40 rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 mb-2">
              <svg className="w-3 h-3 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span className="text-[10px] font-semibold text-emerald-700">Related Changes</span>
            </div>
            <div className="space-y-1.5">
              {relatedChanges.map((change, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <div className="mt-0.5 flex items-center justify-center" style={{ width: 12 }}>
                    <RelatedIcon type={change.changeType} />
                  </div>
                  <p className="text-[11px] text-gray-600 leading-relaxed flex-1">
                    {change.description}
                    {change.targetName && (
                      <span className="text-[#7C3AED] font-medium"> ({change.targetName})</span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Affected sections */}
      {affectedSections.length > 0 && (
        <div className="px-3 pb-2.5">
          <div className="border border-amber-200 bg-amber-50/40 rounded-lg px-2.5 py-2">
            <div className="flex items-center gap-1.5 mb-1.5">
              <svg className="w-3 h-3 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-[10px] font-semibold text-amber-700">Triggers Regeneration</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {affectedSections.map((s) => (
                <span key={s} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${SECTION_BADGE[s] ?? "bg-gray-100 text-gray-600"}`}>
                  {SECTION_LABELS[s] ?? s}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-[#E5E7EB] bg-[#FAFAFA]">
        <button
          onClick={onCancel}
          className="flex-1 text-[11px] font-medium text-gray-600 hover:text-gray-800 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onApply}
          className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] px-3 py-1.5 rounded-lg transition-all shadow-sm"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          Apply Change
        </button>
      </div>
    </div>
  );
}

// ── Time formatting ────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ── Markdown CSS (injected once) ───────────────────────────────────────────

const MD_CSS = `
.md-p  { margin: 0 0 8px; line-height: 1.6; }
.md-p:last-child { margin-bottom: 0; }
.md-h  { font-size: 10px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.08em; color: #6b7280; margin: 10px 0 5px; }
.md-ul, .md-ol { margin: 4px 0 8px 14px; padding: 0; }
.md-ul li { list-style: disc; margin-bottom: 3px; line-height: 1.55; }
.md-ol li { list-style: decimal; margin-bottom: 3px; line-height: 1.55; }
.md-code {
  font-family: ui-monospace, monospace;
  font-size: 0.9em;
  background: #F3F4F6;
  border-radius: 4px;
  padding: 1px 5px;
  color: #374151;
}
`;

// ── Component ──────────────────────────────────────────────────────────────

export function AiChatPanel({ planId, onCollapse, onPlanUpdate }: Props) {
  const [messages,       setMessages]       = useState<Message[]>([]);
  const [input,          setInput]          = useState("");
  const [loading,        setLoading]        = useState(false);
  const [copiedId,       setCopiedId]       = useState<number | null>(null);
  const [patchBanner,    setPatchBanner]    = useState<string | null>(null);
  const [chips,          setChips]          = useState<string[]>(DEFAULT_CHIPS);
  const [chipsLoading,   setChipsLoading]   = useState(true);
  const [showNote,       setShowNote]       = useState(false);
  const [showMenu,       setShowMenu]       = useState(false);
  const [atBottom,       setAtBottom]       = useState(true);
  const [newMsgScrolled, setNewMsgScrolled] = useState(false);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef   = useRef<HTMLDivElement>(null);
  const menuRef     = useRef<HTMLDivElement>(null);
  const msgIdRef    = useRef(0);
  const loaded      = useRef(false);

  // ── Inject markdown CSS once ───────────────────────────────────────────
  useEffect(() => {
    if (document.getElementById("ai-md-styles")) return;
    const style = document.createElement("style");
    style.id = "ai-md-styles";
    style.textContent = MD_CSS;
    document.head.appendChild(style);
  }, []);

  // ── Load messages from localStorage ──────────────────────────────────
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY(planId));
      if (raw) {
        const parsed = JSON.parse(raw) as Message[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          msgIdRef.current = Math.max(...parsed.map((m) => m.id), 0);
          setMessages(parsed);
        }
      }
    } catch { /* ignore */ }

    // Show the context awareness note once per plan
    const dismissed = localStorage.getItem(NOTE_DISM_KEY(planId));
    if (!dismissed) setShowNote(true);
  }, [planId]);

  // ── Persist messages ──────────────────────────────────────────────────
  useEffect(() => {
    if (!loaded.current || messages.length === 0) return;
    try {
      localStorage.setItem(
        STORAGE_KEY(planId),
        JSON.stringify(messages.slice(-MAX_STORED))
      );
    } catch { /* storage full */ }
  }, [messages, planId]);

  // ── Fetch context-aware chips ─────────────────────────────────────────
  useEffect(() => {
    setChipsLoading(true);
    fetch("/api/ai/plan-chips", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ planId }),
    })
      .then((r) => r.json())
      .then((d: { chips?: string[] }) => {
        if (Array.isArray(d.chips) && d.chips.length) setChips(d.chips);
      })
      .catch(() => { /* keep defaults */ })
      .finally(() => setChipsLoading(false));
  }, [planId]);

  // ── Auto-scroll on new messages ───────────────────────────────────────
  useEffect(() => {
    if (atBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      setNewMsgScrolled(false);
    } else if (messages.length > 0) {
      setNewMsgScrolled(true);
    }
  }, [messages, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll tracking ───────────────────────────────────────────────────
  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setAtBottom(nearBottom);
    if (nearBottom) setNewMsgScrolled(false);
  }

  // ── Dismiss patch banner after 3 s ───────────────────────────────────
  useEffect(() => {
    if (!patchBanner) return;
    const t = setTimeout(() => setPatchBanner(null), 3000);
    return () => clearTimeout(t);
  }, [patchBanner]);

  // ── Close menu on outside click ───────────────────────────────────────
  useEffect(() => {
    if (!showMenu) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as globalThis.Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  // ── Auto-resize textarea ──────────────────────────────────────────────
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 104) + "px";
  }, [input]);

  // ── Send ──────────────────────────────────────────────────────────────
  const send = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;

    const userMsg: Message = {
      role:      "user",
      content:   text,
      id:        ++msgIdRef.current,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    if (!overrideText) setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ planId, message: text, history: messages }),
      });
      const data = await res.json() as {
        reply?:    string;
        patch?:    PlanPatch | null;
        proposal?: Proposal | null;
        error?:    string;
      };
      // Use the server's friendly error message directly
      if (data.error) throw new Error(data.error);

      const patched = !!(data.patch && Object.keys(data.patch).length > 0);

      const sections = patched && data.patch
        ? Object.keys(data.patch).map((k) => SECTION_LABELS[k] ?? k).join(", ")
        : undefined;

      const reply = data.reply ?? "Done.";

      setMessages((prev) => [
        ...prev,
        {
          role:        "assistant",
          content:     reply,
          id:          ++msgIdRef.current,
          timestamp:   new Date().toISOString(),
          patched,
          sections,
          proposal:    !patched && data.proposal ? data.proposal : undefined,
          showActions: !patched && !data.proposal && hasProposal(reply),
        },
      ]);

      if (patched && data.patch && onPlanUpdate) {
        onPlanUpdate(data.patch);
        setPatchBanner(`Updated: ${sections}`);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role:      "assistant",
          content:   err instanceof Error ? err.message : "Something went wrong. Please try again.",
          id:        ++msgIdRef.current,
          timestamp: new Date().toISOString(),
          isError:   true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, planId, onPlanUpdate]);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  function dismissAction(id: number) {
    setMessages((prev) =>
      prev.map((m) => m.id === id ? { ...m, showActions: false, proposal: undefined } : m)
    );
  }

  function applyChange(_content: string, id: number) {
    dismissAction(id);
    send("Yes, please apply that change.");
  }

  function copyMessage(content: string, id: number) {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  function clearHistory() {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY(planId));
    setShowMenu(false);
  }

  function copyConversation() {
    const text = messages
      .map((m) => `${m.role === "user" ? "You" : "Assistant"}: ${m.content}`)
      .join("\n\n");
    navigator.clipboard.writeText(text);
    setShowMenu(false);
  }

  function dismissNote() {
    setShowNote(false);
    localStorage.setItem(NOTE_DISM_KEY(planId), "1");
  }

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setNewMsgScrolled(false);
    setAtBottom(true);
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-white select-none">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-[#E5E7EB] shrink-0">
        <div className="flex items-center gap-2.5">
          {/* Icon */}
          <div className="w-7 h-7 bg-[#7C3AED] rounded-lg flex items-center justify-center shadow-sm shrink-0">
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>

          {/* Title + status */}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-[#111827] leading-tight">
              Plan Assistant
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {/* Animated pulse dot */}
              <span className="relative flex w-1.5 h-1.5">
                {loading ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                ) : (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-emerald-500" />
                  </>
                )}
              </span>
              <span className="text-[10px] text-gray-500">
                {loading ? "Gemini · Thinking…" : "Gemini · Ready"}
              </span>
            </div>
          </div>

          {/* ⋯ menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu((v) => !v)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="5"  cy="12" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="19" cy="12" r="1.5" />
              </svg>
            </button>

            {showMenu && (
              <div className="absolute right-0 top-9 bg-white border border-[#E5E7EB] rounded-xl shadow-xl z-50 w-44 py-1 overflow-hidden">
                <button
                  onClick={copyConversation}
                  disabled={messages.length === 0}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy conversation
                </button>
                <div className="h-px bg-[#F3F4F6] mx-2 my-1" />
                <button
                  onClick={clearHistory}
                  disabled={messages.length === 0}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-red-500 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Clear chat
                </button>
              </div>
            )}
          </div>

          {/* Collapse */}
          <button
            onClick={onCollapse}
            title="Collapse panel"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#7C3AED] hover:bg-[#f0f1fe] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Patch applied banner ────────────────────────────────────────── */}
      {patchBanner && (
        <div className="mx-3 mt-2 shrink-0">
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
            <svg className="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-[11px] text-emerald-700 font-medium">{patchBanner}</span>
          </div>
        </div>
      )}

      {/* ── Messages / Empty state ──────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto relative"
        onScroll={onScroll}
      >
        {messages.length === 0 ? (

          /* ── Empty state with context-aware chips ─────────────────── */
          <div className="flex flex-col items-center px-4 pt-10 pb-4">
            <div className="w-12 h-12 bg-[#7C3AED]/10 border border-[#7C3AED]/20 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-[#7C3AED]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <p className="text-[13px] font-semibold text-[#111827] mb-1">Ask me anything about this plan</p>
            <p className="text-[11px] text-gray-400 text-center leading-relaxed mb-6">
              I&apos;ll suggest before I change anything
            </p>

            <div className="w-full space-y-2">
              {chipsLoading ? (
                [0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-11 bg-gray-100 rounded-xl animate-pulse" />
                ))
              ) : (
                chips.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => {
                      setInput(chip);
                      textareaRef.current?.focus();
                    }}
                    className="w-full flex items-center gap-3 bg-[#FAFAFA] hover:bg-[#F5F3FF] border border-[#E5E7EB] hover:border-[#C4B5FD] rounded-xl px-3.5 py-2.5 transition-all group text-left"
                  >
                    <span className="flex-1 text-[12px] text-[#374151] group-hover:text-[#7C3AED] font-medium leading-snug transition-colors">
                      {chip}
                    </span>
                    <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#7C3AED] shrink-0 transition-colors"
                         fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))
              )}
            </div>
          </div>

        ) : (

          /* ── Message thread ─────────────────────────────────────────── */
          <div className="px-3 py-4 space-y-4">
            {messages.map((msg) =>
              msg.role === "user" ? (

                /* User bubble */
                <div key={msg.id} className="flex justify-end group">
                  <div className="max-w-[85%]">
                    <div className="bg-[#7C3AED] text-white rounded-2xl rounded-tr-sm px-3.5 py-2.5 shadow-sm">
                      <p className="text-[12px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    <div className="flex items-center justify-end gap-2 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity pr-1">
                      <button
                        onClick={() => copyMessage(msg.content, msg.id)}
                        className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {copiedId === msg.id ? (
                          <span className="text-emerald-500">Copied</span>
                        ) : (
                          <>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copy
                          </>
                        )}
                      </button>
                      <span className="text-[10px] text-gray-400">{formatTime(msg.timestamp)}</span>
                    </div>
                  </div>
                </div>

              ) : (

                /* Assistant message */
                <div key={msg.id} className="flex items-start gap-2 group">
                  {/* ⚡ icon */}
                  <div className="w-5 h-5 bg-[#7C3AED] rounded-md flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Message body */}
                    {msg.isError ? (
                      <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                        <svg className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <p className="text-[12px] text-red-600 leading-relaxed">{msg.content}</p>
                      </div>
                    ) : (
                      <div
                        className="text-[12px] text-[#374151] leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                      />
                    )}

                    {/* Structured proposal card */}
                    {msg.proposal && (
                      <ProposalCard
                        proposal={msg.proposal}
                        onApply={() => applyChange(msg.content, msg.id)}
                        onCancel={() => dismissAction(msg.id)}
                      />
                    )}

                    {/* Legacy Apply / Dismiss actions (fallback for old stored messages) */}
                    {!msg.proposal && msg.showActions && (
                      <div className="flex items-center gap-2 mt-2.5">
                        <button
                          onClick={() => applyChange(msg.content, msg.id)}
                          className="flex items-center gap-1.5 text-[11px] font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] px-3 py-1.5 rounded-lg transition-all shadow-sm"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          Apply Change
                        </button>
                        <button
                          onClick={() => dismissAction(msg.id)}
                          className="text-[11px] font-medium text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}

                    {/* Footer: updated sections + copy + timestamp */}
                    <div className="flex items-center gap-2 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {msg.patched && msg.sections && (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          Updated: {msg.sections}
                        </span>
                      )}

                      <button
                        onClick={() => copyMessage(msg.content, msg.id)}
                        className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 transition-colors ml-auto"
                      >
                        {copiedId === msg.id ? (
                          <span className="text-emerald-500">Copied</span>
                        ) : (
                          <>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copy
                          </>
                        )}
                      </button>

                      <span className="text-[10px] text-gray-400">{formatTime(msg.timestamp)}</span>
                    </div>
                  </div>
                </div>
              )
            )}

            {/* Typing indicator */}
            {loading && (
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 bg-[#7C3AED] rounded-md flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="flex items-center gap-1.5 py-2">
                  {[0, 220, 440].map((delay) => (
                    <span
                      key={delay}
                      className="w-1.5 h-1.5 bg-gray-400 rounded-full block"
                      style={{
                        animation: "thinking-dot 1.4s ease-in-out infinite",
                        animationDelay: `${delay}ms`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── ↓ New message button ────────────────────────────────────────── */}
      {newMsgScrolled && !atBottom && (
        <div className="absolute bottom-[88px] left-1/2 -translate-x-1/2 z-20">
          <button
            onClick={scrollToBottom}
            className="flex items-center gap-1.5 bg-[#7C3AED] text-white text-[11px] font-semibold px-3 py-1.5 rounded-full shadow-lg hover:bg-[#6D28D9] transition-all"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
            New message
          </button>
        </div>
      )}

      {/* ── Input area ─────────────────────────────────────────────────── */}
      <div className="px-3 py-3 border-t border-[#E5E7EB] shrink-0 bg-white">

        {/* Context awareness note — shown once, dismissable */}
        {showNote && messages.length === 0 && (
          <div
            onClick={dismissNote}
            className="mb-2 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 cursor-pointer hover:bg-gray-100 transition-colors"
          >
            <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-[10px] text-gray-500 flex-1 leading-relaxed">
              I can see your full plan — requirements, entities, APIs, and flows
            </span>
            <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )}

        {/* Textarea + send button */}
        <div
          className="flex items-end gap-2 border rounded-xl px-3 py-2.5 transition-all bg-white"
          style={{
            borderWidth: "1.5px",
            borderColor: "#E5E7EB",
          }}
          onFocusCapture={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = "#7C3AED";
            (e.currentTarget as HTMLDivElement).style.boxShadow   = "0 0 0 3px rgba(124,58,237,0.1)";
          }}
          onBlurCapture={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = "#E5E7EB";
            (e.currentTarget as HTMLDivElement).style.boxShadow   = "none";
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask or request a change..."
            rows={1}
            className="flex-1 bg-transparent text-[12px] text-[#111827] placeholder-gray-400 resize-none focus:outline-none leading-normal"
            style={{ scrollbarWidth: "none", maxHeight: 104, minHeight: 20 }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-all shrink-0 shadow-sm"
            style={{
              background: input.trim() && !loading ? "#7C3AED" : "#E5E7EB",
            }}
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke={input.trim() && !loading ? "white" : "#9CA3AF"}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                    d="M5 12h14m-7-7l7 7-7 7" />
            </svg>
          </button>
        </div>

        <p className="text-[10px] text-gray-400 mt-1.5 text-center">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
