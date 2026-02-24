"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";

type Tab = "account" | "integrations" | "agent-context";

interface AgentContextRow {
  id: string;
  type: "instruction" | "company" | "pod";
  podName: string | null;
  title: string;
  content: string;
  updatedBy: string | null;
  updatedAt: string;
}

function GithubLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function LinearLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M.958 11.295a7.8 7.8 0 0 0 3.747 3.747L.958 11.295ZM.006 8.735l7.259 7.259a8.08 8.08 0 0 1-1.246.006L.006 8.735Zm0-1.44L9.44 16H8.03L0 7.97V7.295Zm1.24-3.056L11.87 14.76a7.9 7.9 0 0 1-1.44.96L1.2 6.176a7.9 7.9 0 0 1 .96-1.44h-.914Zm2.434-2.433L14.309 12.327a7.85 7.85 0 0 1-.914.96L2.681 2.572a7.85 7.85 0 0 1 .96-.914L3.68 2.806Zm2.88-1.473c.378.106.747.24 1.106.397L15.27 9.334a7.73 7.73 0 0 1-.397-1.106L6.56 1.333ZM9.12.248l6.632 6.632a7.8 7.8 0 0 0-3.747-3.747L9.12.248Z" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins !== 1 ? "s" : ""} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

// ── Pod Modal ────────────────────────────────────────────────────────────────

interface PodModalProps {
  initialPodName?: string;
  initialContent?: string;
  isEdit: boolean;
  onSave: (podName: string, content: string) => Promise<void>;
  onClose: () => void;
}

function PodModal({ initialPodName = "", initialContent = "", isEdit, onSave, onClose }: PodModalProps) {
  const [podName, setPodName] = useState(initialPodName);
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadedFile, setLoadedFile] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setContent(ev.target?.result as string ?? "");
      setLoadedFile(file.name);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleSave() {
    if (!podName.trim() || !content.trim()) {
      setError("Pod name and content are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(podName.trim(), content);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save pod.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">
            {isEdit ? "Edit Pod Context" : "Add Pod Context"}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              Pod Name
            </label>
            <input
              type="text"
              value={podName}
              onChange={(e) => setPodName(e.target.value)}
              disabled={isEdit}
              placeholder="e.g. Payments, Identity, Core Banking"
              className="w-full h-10 bg-white border border-slate-200 rounded-xl px-3.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/10 transition-all disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Context
              </label>
              <div className="flex items-center gap-2">
                {loadedFile && (
                  <span className="text-[11px] text-slate-400 italic">Loaded from: {loadedFile}</span>
                )}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 font-medium transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Upload .md file
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".md,.txt"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              placeholder="Describe this pod's services, conventions, infrastructure, and technical constraints..."
              className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-900 placeholder-slate-400 font-mono resize-none focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/10 transition-all"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="h-9 px-4 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !podName.trim() || !content.trim()}
            className="flex items-center gap-2 h-9 px-5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm rounded-xl transition-colors shadow-sm"
          >
            {saving && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {saving ? "Saving…" : "Save Pod"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({ podName, onConfirm, onCancel }: { podName: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-2">Delete Pod Context</h3>
        <p className="text-sm text-slate-500 mb-5">
          Are you sure you want to delete the <span className="font-medium text-slate-700">{podName}</span> pod context? This cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="h-9 px-4 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="h-9 px-5 bg-red-500 hover:bg-red-600 text-white font-medium text-sm rounded-xl transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Agent Context Tab ────────────────────────────────────────────────────────

function AgentContextTab({ canEdit }: { userEmail: string; canEdit: boolean }) {
  const [contexts, setContexts] = useState<AgentContextRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Instruction
  const [instructionContent, setInstructionContent] = useState("");
  const [instructionSaving, setInstructionSaving] = useState(false);
  const [instructionSaved, setInstructionSaved] = useState(false);
  const [instructionFile, setInstructionFile] = useState<string | null>(null);
  const instructionFileRef = useRef<HTMLInputElement>(null);

  // Company
  const [companyContent, setCompanyContent] = useState("");
  const [companySaving, setCompanySaving] = useState(false);
  const [companySaved, setCompanySaved] = useState(false);
  const [companyFile, setCompanyFile] = useState<string | null>(null);
  const companyFileRef = useRef<HTMLInputElement>(null);

  // Pod modal state
  const [podModalOpen, setPodModalOpen] = useState(false);
  const [editingPod, setEditingPod] = useState<AgentContextRow | null>(null);
  const [deletingPod, setDeletingPod] = useState<AgentContextRow | null>(null);

  const instruction = contexts.find((c) => c.type === "instruction") ?? null;
  const company = contexts.find((c) => c.type === "company") ?? null;
  const pods = contexts.filter((c) => c.type === "pod");

  const loadContexts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/agent-context");
      const data = await res.json();
      setContexts(data.contexts ?? []);
      const inst = (data.contexts ?? []).find((c: AgentContextRow) => c.type === "instruction");
      const comp = (data.contexts ?? []).find((c: AgentContextRow) => c.type === "company");
      if (inst) setInstructionContent(inst.content);
      if (comp) setCompanyContent(comp.content);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadContexts(); }, [loadContexts]);

  async function saveInstruction() {
    setInstructionSaving(true);
    try {
      await fetch("/api/agent-context/instruction", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: instructionContent }),
      });
      setInstructionSaved(true);
      setTimeout(() => setInstructionSaved(false), 2500);
      await loadContexts();
    } finally {
      setInstructionSaving(false);
    }
  }

  async function saveCompany() {
    setCompanySaving(true);
    try {
      await fetch("/api/agent-context/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: companyContent }),
      });
      setCompanySaved(true);
      setTimeout(() => setCompanySaved(false), 2500);
      await loadContexts();
    } finally {
      setCompanySaving(false);
    }
  }

  function handleFileUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    setContent: (v: string) => void,
    setFileName: (v: string | null) => void
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setContent(ev.target?.result as string ?? "");
      setFileName(file.name);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleCreatePod(podName: string, content: string) {
    const res = await fetch("/api/agent-context/pods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ podName, content }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Failed to create pod");
    }
    await loadContexts();
  }

  async function handleUpdatePod(podName: string, content: string) {
    const res = await fetch(`/api/agent-context/pods/${encodeURIComponent(podName)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Failed to update pod");
    }
    await loadContexts();
  }

  async function handleDeletePod(podName: string) {
    await fetch(`/api/agent-context/pods/${encodeURIComponent(podName)}`, { method: "DELETE" });
    setDeletingPod(null);
    await loadContexts();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-5 h-5 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Section 1: AI Generation Instructions ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-base font-semibold text-slate-900">AI Generation Instructions</h2>
          {!canEdit && (
            <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md">Read-only</span>
          )}
        </div>
        <p className="text-xs text-slate-500 mb-4 leading-relaxed">
          This instruction is injected as the AI&apos;s system prompt for every plan. It defines output quality, format, and granularity standards.
        </p>

        {/* Toolbar — edit mode only */}
        {canEdit && (
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => instructionFileRef.current?.click()}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 px-3 h-7 rounded-lg transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Upload .md file
              </button>
              <input
                ref={instructionFileRef}
                type="file"
                accept=".md,.txt"
                className="hidden"
                onChange={(e) => handleFileUpload(e, setInstructionContent, setInstructionFile)}
              />
              {instructionFile && (
                <span className="text-[11px] text-slate-400 italic">Loaded from: {instructionFile}</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {instructionSaved && (
                <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Saved
                </span>
              )}
              <button
                onClick={saveInstruction}
                disabled={instructionSaving || !instructionContent.trim()}
                className="flex items-center gap-2 h-8 px-4 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-xs rounded-xl transition-colors shadow-sm"
              >
                {instructionSaving && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {instructionSaving ? "Saving…" : "Save Instructions"}
              </button>
            </div>
          </div>
        )}

        <textarea
          value={instructionContent}
          onChange={(e) => canEdit && setInstructionContent(e.target.value)}
          readOnly={!canEdit}
          rows={12}
          className={cn(
            "w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 font-mono transition-all",
            canEdit
              ? "bg-slate-50 resize-y focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/10"
              : "bg-slate-50/50 resize-none cursor-default text-slate-600"
          )}
          placeholder="Enter AI generation instructions..."
        />

        {instruction && (
          <p className="text-[11px] text-slate-400 mt-2">
            Updated {timeAgo(instruction.updatedAt)}{instruction.updatedBy ? ` by ${instruction.updatedBy}` : ""}
          </p>
        )}
      </div>

      {/* ── Section 2: Company Context ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-base font-semibold text-slate-900">Company Context</h2>
          {!canEdit && (
            <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md">Read-only</span>
          )}
        </div>
        <p className="text-xs text-slate-500 mb-4 leading-relaxed">
          Global context about the company injected into every plan. Describe your engineering org, infrastructure, conventions, and cross-service patterns.
        </p>

        {/* Toolbar — edit mode only */}
        {canEdit && (
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => companyFileRef.current?.click()}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 px-3 h-7 rounded-lg transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Upload .md file
              </button>
              <input
                ref={companyFileRef}
                type="file"
                accept=".md,.txt"
                className="hidden"
                onChange={(e) => handleFileUpload(e, setCompanyContent, setCompanyFile)}
              />
              {companyFile && (
                <span className="text-[11px] text-slate-400 italic">Loaded from: {companyFile}</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {companySaved && (
                <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Saved
                </span>
              )}
              <button
                onClick={saveCompany}
                disabled={companySaving || !companyContent.trim()}
                className="flex items-center gap-2 h-8 px-4 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-xs rounded-xl transition-colors shadow-sm"
              >
                {companySaving && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {companySaving ? "Saving…" : "Save Company Context"}
              </button>
            </div>
          </div>
        )}

        <textarea
          value={companyContent}
          onChange={(e) => canEdit && setCompanyContent(e.target.value)}
          readOnly={!canEdit}
          rows={8}
          className={cn(
            "w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 font-mono transition-all",
            canEdit
              ? "bg-slate-50 resize-y focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/10"
              : "bg-slate-50/50 resize-none cursor-default text-slate-600"
          )}
          placeholder={company ? "" : "Describe your engineering org, infrastructure, conventions, and cross-service patterns..."}
        />

        {company && (
          <p className="text-[11px] text-slate-400 mt-2">
            Updated {timeAgo(company.updatedAt)}{company.updatedBy ? ` by ${company.updatedBy}` : ""}
          </p>
        )}
      </div>

      {/* ── Section 3: Pod Contexts ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-base font-semibold text-slate-900">Pod Contexts</h2>
          <button
            onClick={() => { setEditingPod(null); setPodModalOpen(true); }}
            className="flex items-center gap-1.5 h-8 px-4 bg-violet-600 hover:bg-violet-700 text-white font-medium text-xs rounded-xl transition-colors shadow-sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add Pod Context
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-5 leading-relaxed">
          Pod-specific context injected when an engineer selects a pod during plan creation. Each pod can have its own service details, conventions, and constraints.
        </p>

        {pods.length === 0 ? (
          <div className="border border-dashed border-slate-200 rounded-xl p-8 text-center">
            <p className="text-sm text-slate-400">No pod contexts yet. Add one to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pods.map((pod) => (
              <div key={pod.id} className="border border-slate-200 rounded-xl p-4 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 mb-0.5">{pod.podName}</p>
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {pod.content.slice(0, 120)}{pod.content.length > 120 ? "…" : ""}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Updated {timeAgo(pod.updatedAt)}{pod.updatedBy ? ` by ${pod.updatedBy}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => { setEditingPod(pod); setPodModalOpen(true); }}
                    className="h-7 px-3 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-lg transition-all"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeletingPod(pod)}
                    className="h-7 px-3 text-xs font-medium text-red-500 hover:text-red-700 border border-red-200 hover:border-red-300 rounded-lg transition-all"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pod Add/Edit Modal */}
      {podModalOpen && (
        <PodModal
          isEdit={!!editingPod}
          initialPodName={editingPod?.podName ?? ""}
          initialContent={editingPod?.content ?? ""}
          onSave={editingPod ? (_, content) => handleUpdatePod(editingPod.podName!, content) : handleCreatePod}
          onClose={() => { setPodModalOpen(false); setEditingPod(null); }}
        />
      )}

      {/* Delete Confirmation */}
      {deletingPod && (
        <DeleteConfirm
          podName={deletingPod.podName!}
          onConfirm={() => handleDeletePod(deletingPod.podName!)}
          onCancel={() => setDeletingPod(null)}
        />
      )}
    </div>
  );
}

// ── Main Settings Page ───────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("account");
  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to save.");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const tabs: { id: Tab; label: string; adminOnly?: boolean }[] = [
    { id: "account", label: "Account" },
    { id: "integrations", label: "Integrations" },
    { id: "agent-context" as Tab, label: "Agent Context" },
  ];

  return (
    <div className="max-w-2xl mx-auto px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your account and integrations.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 mb-8">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px",
              tab === t.id
                ? "border-violet-600 text-violet-700"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            )}
          >
            {t.adminOnly && <LockIcon className="w-3 h-3" />}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Account Tab ── */}
      {tab === "account" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900 mb-5">Profile</h2>

          {/* Avatar */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-violet-100 border border-violet-200 flex items-center justify-center shrink-0">
              <span className="text-lg font-bold text-violet-600 uppercase">
                {(user?.name?.[0] ?? user?.email?.[0] ?? "?").toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">{user?.name ?? "—"}</p>
              <p className="text-xs text-slate-400">{user?.email}</p>
            </div>
          </div>

          <form onSubmit={handleSaveName} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Display Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full h-10 bg-white border border-slate-200 rounded-xl px-3.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/10 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={user?.email ?? ""}
                readOnly
                className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3.5 text-sm text-slate-400 cursor-not-allowed"
              />
              <p className="text-xs text-slate-400 mt-1.5">Email cannot be changed.</p>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                <svg className="w-3.5 h-3.5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="flex items-center gap-2 h-9 px-5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm rounded-xl transition-colors shadow-sm"
              >
                {saving && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {saving ? "Saving…" : "Save Changes"}
              </button>
              {saved && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Saved
                </span>
              )}
            </div>
          </form>
        </div>
      )}

      {/* ── Integrations Tab ── */}
      {tab === "integrations" && (
        <div className="space-y-4">
          {/* GitHub Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-start gap-4 opacity-60">
            <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center shrink-0">
              <GithubLogo className="w-5 h-5 text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="text-sm font-semibold text-slate-500">GitHub</h3>
                <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full">
                  Coming Soon
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Connect a GitHub repo so AI-generated plans use your actual codebase as context.
              </p>
            </div>
            <div className="shrink-0 h-8 px-3.5 flex items-center gap-1.5 text-xs font-medium text-slate-400 bg-slate-50 border border-slate-200 rounded-lg cursor-not-allowed select-none">
              Connect
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>

          {/* Linear Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#5e6ad2] flex items-center justify-center shrink-0">
              <LinearLogo className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="text-sm font-semibold text-slate-900">Linear</h3>
                {user?.hasLinearToken ? (
                  <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    Connected
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                    Not connected
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                {user?.hasLinearToken
                  ? "Push Epics, Stories, and Tasks directly from any plan to your Linear workspace."
                  : "Connect Linear to push tickets directly from plans to your workspace."}
              </p>
            </div>
            <Link
              href="/settings/integrations/linear"
              className="shrink-0 h-8 px-3.5 flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-lg transition-all"
            >
              {user?.hasLinearToken ? "Configure" : "Connect"}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      )}

      {/* ── Agent Context Tab ── */}
      {tab === "agent-context" && (
        <AgentContextTab userEmail={user?.email ?? ""} canEdit={user?.agentContextEnabled ?? false} />
      )}
    </div>
  );
}
