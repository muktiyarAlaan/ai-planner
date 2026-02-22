"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { PlanPatch } from "./plan-view";

interface Message {
  role:      "user" | "assistant";
  content:   string;
  id:        number;
  patched?:  boolean; // true when this response included a plan patch
  sections?: string;  // human-readable list of updated sections
}

interface Props {
  planId:        string;
  onCollapse:    () => void;
  onPlanUpdate?: (patch: PlanPatch) => void;
}

const SUGGESTIONS = [
  { icon: "🔍", label: "Analyse",  text: "What's missing from this plan?" },
  { icon: "🔒", label: "Security", text: "Review the security model" },
  { icon: "✏️",  label: "Improve",  text: "Add an audit log entity with id, userId, action, createdAt fields" },
  { icon: "📖", label: "Explain",  text: "Explain the user flow step by step" },
];

const STORAGE_KEY = (planId: string) => `ai-chat-${planId}`;
const MAX_STORED  = 60; // cap stored messages to keep localStorage lean

export function AiChatPanel({ planId, onCollapse, onPlanUpdate }: Props) {
  const [messages,  setMessages]  = useState<Message[]>([]);
  const [input,     setInput]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [copiedId,  setCopiedId]  = useState<number | null>(null);
  const [patchBanner, setPatchBanner] = useState<string | null>(null);
  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const msgIdRef    = useRef(0);
  const loaded      = useRef(false);

  // ── Persist: load on mount ─────────────────────────────────────────────────
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY(planId));
      if (raw) {
        const parsed = JSON.parse(raw) as Message[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Sync the ID counter so new messages don't collide
          msgIdRef.current = Math.max(...parsed.map((m) => m.id), 0);
          setMessages(parsed);
        }
      }
    } catch { /* ignore malformed storage */ }
  }, [planId]);

  // ── Persist: save on change ────────────────────────────────────────────────
  useEffect(() => {
    if (!loaded.current || messages.length === 0) return;
    try {
      const toStore = messages.slice(-MAX_STORED);
      localStorage.setItem(STORAGE_KEY(planId), JSON.stringify(toStore));
    } catch { /* storage full — ignore */ }
  }, [messages, planId]);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ── Auto-resize textarea ───────────────────────────────────────────────────
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [input]);

  // ── Auto-dismiss patch banner after 3 s ───────────────────────────────────
  useEffect(() => {
    if (!patchBanner) return;
    const t = setTimeout(() => setPatchBanner(null), 3000);
    return () => clearTimeout(t);
  }, [patchBanner]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text, id: ++msgIdRef.current };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ planId, message: text, history: messages }),
      });
      const data = await res.json() as { reply?: string; patch?: PlanPatch | null; error?: string };
      if (data.error) throw new Error(data.error);

      const patched = !!(data.patch && Object.keys(data.patch).length > 0);

      // Human-readable section names
      const SECTION_LABELS: Record<string, string> = {
        entities:      "Entities",
        requirements:  "Requirements",
        apiEndpoints:  "API",
        contextMd:     "Context",
        linearTickets: "Linear Tickets",
      };
      const sections = patched && data.patch
        ? Object.keys(data.patch).map((k) => SECTION_LABELS[k] ?? k).join(", ")
        : undefined;

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply ?? "Done.", id: ++msgIdRef.current, patched, sections },
      ]);

      // Apply patch to the plan UI
      if (patched && data.patch && onPlanUpdate) {
        onPlanUpdate(data.patch);
        setPatchBanner(`Updated: ${sections}`);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role:    "assistant",
          content: `Something went wrong: ${err instanceof Error ? err.message : "Unknown error"}`,
          id:      ++msgIdRef.current,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, planId, onPlanUpdate]);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
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
  }

  return (
    <div className="flex flex-col h-full bg-white select-none">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-[#e2e8f0] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#7C3AED] rounded-xl flex items-center justify-center shadow-sm shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-[#0f172a] leading-tight">AI Assistant</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-[#94a3b8]">Gemini · Ready</span>
            </div>
          </div>

          {/* Clear history */}
          {messages.length > 0 && (
            <button
              onClick={clearHistory}
              title="Clear chat history"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[#94a3b8] hover:text-red-400 hover:bg-red-50 transition-colors shrink-0"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}

          {/* Collapse */}
          <button
            onClick={onCollapse}
            title="Minimize AI chat"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#94a3b8] hover:text-[#7C3AED] hover:bg-[#f0f1fe] transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Patch applied banner ─────────────────────────────────────────── */}
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

      {/* ── Messages ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center px-4 pt-8 pb-4">
            <div className="w-14 h-14 bg-[#7C3AED]/8 border border-[#7C3AED]/15 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-[#7C3AED]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <p className="text-[13px] font-bold text-[#0f172a] mb-1">Plan Assistant</p>
            <p className="text-[11px] text-[#94a3b8] text-center leading-relaxed mb-6 max-w-[190px]">
              Ask me to analyse, improve, or <strong className="text-[#7C3AED]">directly modify</strong> any part of this plan
            </p>
            <div className="w-full space-y-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.text}
                  onClick={() => { setInput(s.text); textareaRef.current?.focus(); }}
                  className="w-full flex items-center gap-3 bg-[#f8fafc] hover:bg-[#f0f1fe] border border-[#e2e8f0] hover:border-[#c7d2fe] rounded-xl px-3.5 py-2.5 transition-all group text-left"
                >
                  <span className="text-base shrink-0">{s.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className="block text-[9px] text-[#94a3b8] font-bold uppercase tracking-wider leading-none mb-0.5">
                      {s.label}
                    </span>
                    <span className="block text-[11px] text-[#374151] group-hover:text-[#7C3AED] font-medium leading-snug truncate transition-colors">
                      {s.text}
                    </span>
                  </div>
                  <svg className="w-3.5 h-3.5 text-[#cbd5e1] group-hover:text-[#7C3AED] shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Message thread */
          <div className="px-4 py-4 space-y-4">
            {messages.map((msg) =>
              msg.role === "user" ? (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[84%] bg-[#7C3AED] text-white rounded-2xl rounded-tr-sm px-3.5 py-2.5 shadow-sm">
                    <p className="text-[12px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ) : (
                <div key={msg.id} className="flex items-start gap-2.5 group">
                  <div className="w-6 h-6 bg-[#7C3AED] rounded-md flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                      <p className="text-[12px] text-[#374151] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>

                    {/* Patch badge + copy */}
                    <div className="flex items-center gap-2 mt-1 pl-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                        className="flex items-center gap-1 text-[10px] text-[#94a3b8] hover:text-[#64748b] transition-colors"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <svg className="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-emerald-500">Copied</span>
                          </>
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
                    </div>
                  </div>
                </div>
              )
            )}

            {/* Typing indicator */}
            {loading && (
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 bg-[#7C3AED] rounded-md flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl rounded-tl-sm px-4 py-4 flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-[#94a3b8] rounded-full block" style={{ animation: 'thinking-dot 1.4s ease-in-out infinite', animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-[#94a3b8] rounded-full block" style={{ animation: 'thinking-dot 1.4s ease-in-out infinite', animationDelay: '220ms' }} />
                  <span className="w-2 h-2 bg-[#94a3b8] rounded-full block" style={{ animation: 'thinking-dot 1.4s ease-in-out infinite', animationDelay: '440ms' }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── Input ────────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-t border-[#e2e8f0] shrink-0 bg-white">
        <div className="flex items-center gap-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl px-3.5 py-2.5 focus-within:border-[#7C3AED]/40 focus-within:ring-2 focus-within:ring-[#7C3AED]/8 transition-all shadow-sm">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask or request a change…"
            rows={1}
            className="flex-1 bg-transparent text-[12px] text-[#0f172a] placeholder-[#94a3b8] resize-none focus:outline-none leading-normal"
            style={{ scrollbarWidth:"none", maxHeight:120, minHeight:20 }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="w-7 h-7 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:bg-[#e2e8f0] disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-all shrink-0 shadow-sm"
          >
            <svg
              className={`w-3.5 h-3.5 ${input.trim() && !loading ? "text-white" : "text-[#94a3b8]"}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14m-7-7l7 7-7 7" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-[#cbd5e1] mt-1.5 text-center">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
