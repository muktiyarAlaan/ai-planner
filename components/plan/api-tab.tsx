"use client";

import { useState, useMemo } from "react";
import { ApiEndpoint } from "@/types/plan";
import { cn } from "@/lib/utils";

interface Props {
  apiEndpoints: ApiEndpoint[] | null;
  planId: string;
  onUpdate: (eps: ApiEndpoint[]) => void;
}

const METHOD_META: Record<string, { badge: string; bar: string; filter: string }> = {
  GET:    { badge: "bg-blue-50 text-blue-600 border-blue-200",          bar: "#2563EB", filter: "bg-blue-50 text-blue-600 border-blue-300" },
  POST:   { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", bar: "#16A34A", filter: "bg-emerald-50 text-emerald-700 border-emerald-300" },
  PUT:    { badge: "bg-amber-50 text-amber-700 border-amber-200",       bar: "#D97706", filter: "bg-amber-50 text-amber-700 border-amber-300" },
  DELETE: { badge: "bg-red-50 text-red-600 border-red-200",             bar: "#DC2626", filter: "bg-red-50 text-red-600 border-red-300" },
  PATCH:  { badge: "bg-purple-50 text-purple-600 border-purple-200",    bar: "#7C3AED", filter: "bg-purple-50 text-purple-600 border-purple-300" },
};

const FALLBACK_META = { badge: "bg-gray-50 text-gray-600 border-gray-200", bar: "#94a3b8", filter: "bg-gray-50 text-gray-600 border-gray-300" };
const HTTP_METHODS: ApiEndpoint["method"][] = ["GET", "POST", "PUT", "DELETE", "PATCH"];

function CopyButton({ text, label }: { text: string; label?: string }) {
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
        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
      {label ?? ""}
    </button>
  );
}

function JsonBlock({ json }: { json: Record<string, unknown> }) {
  const text = JSON.stringify(json, null, 2);
  return (
    <div className="relative group/json">
      <pre className="text-[11.5px] text-[#334155] font-mono bg-white border border-[#e2e8f0] rounded-lg px-4 py-3.5 overflow-auto max-h-48 leading-relaxed">
        {text}
      </pre>
      <div className="absolute top-2 right-2 opacity-0 group-hover/json:opacity-100 transition-opacity">
        <CopyButton text={text} />
      </div>
    </div>
  );
}

// ── Endpoint edit form ─────────────────────────────────────────────────────────
function EndpointEditForm({
  initial,
  onSave,
  onCancel,
  onDelete,
  isNew,
}: {
  initial: ApiEndpoint;
  onSave: (ep: ApiEndpoint) => void;
  onCancel: () => void;
  onDelete?: () => void;
  isNew?: boolean;
}) {
  const [ep,          setEp]          = useState<ApiEndpoint>({ ...initial });
  const [reqBodyText, setReqBodyText] = useState(initial.requestBody ? JSON.stringify(initial.requestBody, null, 2) : "");
  const [resBodyText, setResBodyText] = useState(initial.responseBody ? JSON.stringify(initial.responseBody, null, 2) : "");
  const [reqError,    setReqError]    = useState("");
  const [resError,    setResError]    = useState("");

  function save() {
    let requestBody: Record<string, unknown> | null = null;
    let responseBody: Record<string, unknown> | null = null;
    if (reqBodyText.trim()) {
      try { requestBody = JSON.parse(reqBodyText); setReqError(""); }
      catch { setReqError("Invalid JSON"); return; }
    }
    if (resBodyText.trim()) {
      try { responseBody = JSON.parse(resBodyText); setResError(""); }
      catch { setResError("Invalid JSON"); return; }
    }
    onSave({ ...ep, requestBody, responseBody });
  }

  return (
    <div className="bg-white border border-[#7C3AED]/30 rounded-xl p-4 space-y-3 shadow-sm">
      <div className="grid grid-cols-[120px_1fr] gap-3">
        <div>
          <label className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wider block mb-1">Method</label>
          <select
            value={ep.method}
            onChange={(e) => setEp({ ...ep, method: e.target.value as ApiEndpoint["method"] })}
            className="w-full text-[12px] font-mono font-semibold bg-[#f8fafc] border border-[#e2e8f0] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#7C3AED] transition-colors"
          >
            {HTTP_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wider block mb-1">Path</label>
          <input
            value={ep.path}
            onChange={(e) => setEp({ ...ep, path: e.target.value })}
            placeholder="/api/resource"
            className="w-full text-[12px] font-mono bg-[#f8fafc] border border-[#e2e8f0] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#7C3AED] transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wider block mb-1">Description</label>
        <textarea
          value={ep.description}
          onChange={(e) => setEp({ ...ep, description: e.target.value })}
          rows={2}
          placeholder="What does this endpoint do?"
          className="w-full text-[12px] text-[#374151] bg-[#f8fafc] border border-[#e2e8f0] rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:border-[#7C3AED] transition-colors"
        />
      </div>

      <div className="flex items-center gap-3">
        <label className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wider">Auth required</label>
        <button
          type="button"
          onClick={() => setEp({ ...ep, auth: !ep.auth })}
          className={cn("w-8 h-4 rounded-full transition-colors relative shrink-0", ep.auth ? "bg-[#7C3AED]" : "bg-[#e2e8f0]")}
        >
          <span className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform", ep.auth ? "translate-x-4" : "translate-x-0.5")} />
        </button>
        <span className="text-[11px] text-[#64748b]">{ep.auth ? "Auth" : "Public"}</span>
      </div>

      <div>
        <label className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wider block mb-1">Request Body (JSON)</label>
        <textarea
          value={reqBodyText}
          onChange={(e) => { setReqBodyText(e.target.value); setReqError(""); }}
          rows={3}
          placeholder='{"key": "value"}'
          className={cn("w-full text-[11.5px] font-mono bg-[#f8fafc] border rounded-lg px-2.5 py-2 resize-y focus:outline-none transition-colors",
            reqError ? "border-red-400" : "border-[#e2e8f0] focus:border-[#7C3AED]")}
        />
        {reqError && <p className="text-[10px] text-red-500 mt-0.5">{reqError}</p>}
      </div>

      <div>
        <label className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wider block mb-1">Response Body (JSON)</label>
        <textarea
          value={resBodyText}
          onChange={(e) => { setResBodyText(e.target.value); setResError(""); }}
          rows={3}
          placeholder='{"id": "uuid", ...}'
          className={cn("w-full text-[11.5px] font-mono bg-[#f8fafc] border rounded-lg px-2.5 py-2 resize-y focus:outline-none transition-colors",
            resError ? "border-red-400" : "border-[#e2e8f0] focus:border-[#7C3AED]")}
        />
        {resError && <p className="text-[10px] text-red-500 mt-0.5">{resError}</p>}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button onClick={save} className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          Save
        </button>
        <button onClick={onCancel} className="text-[12px] font-medium px-3 py-1.5 bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#64748b] rounded-lg transition-colors">
          Cancel
        </button>
        {!isNew && onDelete && (
          <button onClick={onDelete} className="ml-auto flex items-center gap-1.5 text-[12px] font-medium text-red-500 hover:text-red-600 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

// ── Single endpoint card ───────────────────────────────────────────────────────
function EndpointCard({
  endpoint,
  onSave,
  onDelete,
}: {
  endpoint: ApiEndpoint;
  onSave: (ep: ApiEndpoint) => void;
  onDelete: () => void;
}) {
  const [expanded,       setExpanded]       = useState(false);
  const [editing,        setEditing]        = useState(false);
  const [bodyTab,        setBodyTab]        = useState<"request" | "response">("request");
  const [confirmDelete,  setConfirmDelete]  = useState(false);

  const meta        = METHOD_META[endpoint.method] ?? FALLBACK_META;
  const hasRequest  = !!endpoint.requestBody;
  const hasResponse = !!endpoint.responseBody;
  const hasBoth     = hasRequest && hasResponse;
  const hasBody     = hasRequest || hasResponse;
  const activeBodyTab: "request" | "response" = hasBoth ? bodyTab : hasRequest ? "request" : "response";

  if (editing) {
    return (
      <EndpointEditForm
        initial={endpoint}
        onSave={(ep) => { onSave(ep); setEditing(false); }}
        onCancel={() => setEditing(false)}
        onDelete={() => { setEditing(false); onDelete(); }}
      />
    );
  }

  return (
    <div
      className={cn(
        "bg-white rounded-xl overflow-hidden transition-all duration-200 group/card",
        expanded ? "border border-[#c7d2fe] shadow-sm" : "border border-[#e2e8f0] hover:border-[#7C3AED]/30 hover:shadow-sm"
      )}
      style={{ borderLeft: `3px solid ${meta.bar}` }}
    >
      <div className="flex items-center gap-3.5 px-4 py-3.5">
        <span
          className={cn("text-[11px] font-bold font-mono px-2 py-0.5 rounded border shrink-0 text-center", meta.badge)}
          style={{ minWidth: 52 }}
        >
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

        <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
          <CopyButton text={endpoint.path} />
          <button
            onClick={(e) => { e.stopPropagation(); setEditing(true); }}
            className="w-6 h-6 flex items-center justify-center rounded text-[#94a3b8] hover:text-[#7C3AED] hover:bg-[#f5f3ff] transition-colors"
            title="Edit endpoint"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-[10px] font-medium px-1.5 py-0.5 bg-red-500 hover:bg-red-600 text-white rounded transition-colors">Delete</button>
              <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }} className="text-[10px] font-medium px-1.5 py-0.5 bg-[#f1f5f9] text-[#64748b] rounded transition-colors">✕</button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
              className="w-6 h-6 flex items-center justify-center rounded text-[#94a3b8] hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
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
                {activeBodyTab === "request" && endpoint.requestBody && <JsonBlock json={endpoint.requestBody} />}
                {activeBodyTab === "response" && endpoint.responseBody && <JsonBlock json={endpoint.responseBody} />}
              </div>
            </>
          ) : (
            <div className="p-4">
              {hasRequest && endpoint.requestBody && (<><p className="text-[10px] text-[#94a3b8] uppercase tracking-wider font-semibold mb-2">Request Body</p><JsonBlock json={endpoint.requestBody} /></>)}
              {hasResponse && endpoint.responseBody && (<><p className="text-[10px] text-[#94a3b8] uppercase tracking-wider font-semibold mb-2">Response Body</p><JsonBlock json={endpoint.responseBody} /></>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const BLANK_ENDPOINT: ApiEndpoint = { method: "GET", path: "", description: "", auth: false, requestBody: null, responseBody: null };

export function ApiTab({ apiEndpoints, planId, onUpdate }: Props) {
  const [endpoints,    setEndpoints]    = useState<ApiEndpoint[]>(apiEndpoints ?? []);
  const [search,       setSearch]       = useState("");
  const [methodFilter, setMethodFilter] = useState<string | null>(null);
  const [addingNew,    setAddingNew]    = useState(false);

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

  async function persist(updated: ApiEndpoint[]) {
    setEndpoints(updated);
    onUpdate(updated);
    try {
      await fetch(`/api/plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiEndpoints: updated }),
      });
    } catch { /* silent */ }
  }

  function handleSave(ep: ApiEndpoint, originalEp: ApiEndpoint) {
    const i = endpoints.indexOf(originalEp);
    if (i === -1) return;
    const updated = [...endpoints];
    updated[i] = ep;
    persist(updated);
  }

  function handleDelete(ep: ApiEndpoint) {
    persist(endpoints.filter((e) => e !== ep));
  }

  if (!endpoints.length && !addingNew) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <div className="w-12 h-12 bg-[#f1f5f9] rounded-2xl flex items-center justify-center">
          <svg className="w-5 h-5 text-[#94a3b8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-[13px] font-medium text-[#64748b]">No API endpoints generated</p>
        <button
          onClick={() => setAddingNew(true)}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg transition-colors shadow-sm"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Endpoint
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
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
          <button
            onClick={() => setAddingNew(true)}
            className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg transition-colors shadow-sm shrink-0"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add
          </button>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setMethodFilter(null)}
            className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all",
              !methodFilter ? "bg-[#0f172a] text-white border-[#0f172a]" : "bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#cbd5e1] hover:text-[#374151]")}
          >All</button>
          {presentMethods.map((method) => {
            const meta = METHOD_META[method] ?? FALLBACK_META;
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

      <div className="flex-1 overflow-y-auto p-5 space-y-2.5">
        {addingNew && (
          <EndpointEditForm
            initial={BLANK_ENDPOINT}
            isNew
            onSave={(ep) => { persist([...endpoints, ep]); setAddingNew(false); }}
            onCancel={() => setAddingNew(false)}
          />
        )}

        {filtered.length === 0 && !addingNew ? (
          <div className="flex items-center justify-center h-32 text-[12px] text-[#94a3b8]">No endpoints match your filter</div>
        ) : (
          filtered.map((ep, i) => (
            <EndpointCard
              key={i}
              endpoint={ep}
              onSave={(updated) => handleSave(updated, ep)}
              onDelete={() => handleDelete(ep)}
            />
          ))
        )}
      </div>
    </div>
  );
}
