"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";

interface GithubRepo {
  fullName: string;
  owner: string;
  repo: string;
  private: boolean;
  updatedAt: string;
}

function GithubLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

export default function GithubSettingsPage() {
  const { user } = useAuth();

  const [step,         setStep]         = useState<1 | 2>(1);
  const [token,        setToken]        = useState("");
  const [repos,        setRepos]        = useState<GithubRepo[]>([]);
  const [selected,     setSelected]     = useState<Set<string>>(
    new Set((user?.githubRepos ?? []).map((r) => r.fullName))
  );
  const [filter,       setFilter]       = useState("");
  const [loading,      setLoading]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [disconnecting,setDisconnecting]= useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const isConnected = !!user?.hasGithubToken;

  const filteredRepos = repos.filter((r) =>
    r.fullName.toLowerCase().includes(filter.toLowerCase())
  );

  function toggleRepo(fullName: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fullName)) next.delete(fullName);
      else next.add(fullName);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(filteredRepos.map((r) => r.fullName)));
  }

  function clearAll() {
    setSelected(new Set());
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res  = await fetch("/api/user/github-token", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong."); return; }
      setRepos(data.repos ?? []);
      // Pre-select previously saved repos if reconnecting
      if (user?.githubRepos?.length) {
        setSelected(new Set(user.githubRepos.map((r) => r.fullName)));
      }
      setStep(2);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveRepos() {
    setSaving(true);
    setError(null);
    try {
      const selectedRepos = repos
        .filter((r) => selected.has(r.fullName))
        .map(({ fullName, owner, repo }) => ({ fullName, owner, repo }));

      const res = await fetch("/api/user/github-repos", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ repos: selectedRepos }),
      });
      if (!res.ok) { setError("Failed to save repos."); return; }
      window.location.href = "/settings";
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/user/github-token", { method: "DELETE" });
      if (!res.ok) { setError("Failed to disconnect."); return; }
      window.location.href = "/settings";
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleChangeRepos() {
    // Re-enter flow with existing token — fetch repos fresh
    setLoading(true);
    setError(null);
    try {
      // We don't have the raw token client-side (it's encrypted), so ask user to re-enter
      setStep(1);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-[520px] mx-auto px-4 py-10">
      {/* Back */}
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 mb-8 transition-colors group"
      >
        <svg className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Settings
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center shrink-0">
          <GithubLogo className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">GitHub</h1>
          <p className="text-xs text-slate-500">Connect repos so AI plans use your actual codebase as context.</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-slate-700 to-slate-500" />
        <div className="p-7">

          {/* ── Already connected: show repos + manage ── */}
          {isConnected && step === 1 && (
            <>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-5 h-5 bg-emerald-400 rounded-full flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-xs text-emerald-700 font-medium bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full">
                  Connected
                </span>
              </div>

              <h2 className="text-base font-semibold text-slate-900 mb-1.5">GitHub is connected</h2>

              {user?.githubRepos && user.githubRepos.length > 0 ? (
                <>
                  <p className="text-sm text-slate-500 mb-4">
                    {user.githubRepos.length} repo{user.githubRepos.length !== 1 ? "s" : ""} selected as context:
                  </p>
                  <div className="space-y-1.5 mb-6">
                    {user.githubRepos.map((r) => (
                      <div key={r.fullName} className="flex items-center gap-2.5 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
                        <GithubLogo className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-xs font-mono text-slate-700 truncate">{r.fullName}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500 mb-6">No repos selected yet. Click "Change repos" to select.</p>
              )}

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 mb-4">
                  <svg className="w-3.5 h-3.5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-red-600">{error}</p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={handleChangeRepos}
                  className="h-9 px-4 flex items-center gap-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-xl transition-all"
                >
                  Change repos
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="flex items-center gap-2 h-9 px-4 bg-red-50 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed text-red-600 font-medium text-sm rounded-xl border border-red-200 transition-colors"
                >
                  {disconnecting && <div className="w-3.5 h-3.5 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />}
                  {disconnecting ? "Disconnecting…" : "Disconnect"}
                </button>
              </div>
            </>
          )}

          {/* ── Step 1: Token input ── */}
          {!isConnected && step === 1 && (
            <form onSubmit={handleConnect} className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-slate-900 mb-1">Add your Personal Access Token</h2>
                <p className="text-sm text-slate-500">
                  Generate a Personal Access Token from your GitHub account settings.
                </p>
              </div>

              {/* Scope note */}
              <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3">
                <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-xs text-amber-800 leading-relaxed">
                  <span className="font-semibold">Required scope: </span>
                  Classic token: <code className="font-mono bg-amber-100 px-1 rounded">repo</code> (read-only is enough).
                  Fine-grained token: <code className="font-mono bg-amber-100 px-1 rounded">Contents: Read-only</code>.
                  We never write to your repos.
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  Personal Access Token
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="ghp_... or github_pat_..."
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full h-10 bg-white border border-slate-200 rounded-xl px-3.5 pr-9 text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-500/10 transition-all"
                  />
                  {token && (
                    <button type="button" onClick={() => setToken("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                  <svg className="w-3.5 h-3.5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-red-600">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={!token.trim() || loading}
                className="w-full flex items-center justify-center gap-2 h-10 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm rounded-xl transition-colors shadow-sm"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <GithubLogo className="w-4 h-4" />
                )}
                {loading ? "Fetching repos…" : "Connect GitHub"}
              </button>
            </form>
          )}

          {/* ── Step 2: Repo selection ── */}
          {step === 2 && (
            <>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-5 h-5 bg-emerald-400 rounded-full flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-xs text-emerald-700 font-medium bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full">
                  Token verified — {repos.length} repo{repos.length !== 1 ? "s" : ""} accessible
                </span>
              </div>

              <h2 className="text-base font-semibold text-slate-900 mb-1">Select repos to use as context</h2>
              <p className="text-sm text-slate-500 mb-4">
                Plans will reference these repos. You can select multiple.
              </p>

              {/* Filter + select controls */}
              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Filter repos…"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="w-full h-8 bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-slate-300 focus:ring-1 focus:ring-slate-200 transition-all"
                  />
                </div>
                <button onClick={selectAll} className="h-8 px-2.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 hover:border-slate-300 bg-white rounded-lg transition-all">
                  All
                </button>
                <button onClick={clearAll} className="h-8 px-2.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 hover:border-slate-300 bg-white rounded-lg transition-all">
                  None
                </button>
              </div>

              {/* Repo list */}
              <div className="space-y-1.5 max-h-[320px] overflow-y-auto mb-4 pr-0.5">
                {filteredRepos.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-slate-400">No repos match your filter.</p>
                  </div>
                ) : (
                  filteredRepos.map((r) => {
                    const isSelected = selected.has(r.fullName);
                    return (
                      <button
                        key={r.fullName}
                        onClick={() => toggleRepo(r.fullName)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all",
                          isSelected
                            ? "bg-slate-900/[0.03] border-slate-400/40 ring-1 ring-slate-400/10"
                            : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                        )}
                      >
                        {/* Checkbox */}
                        <div className={cn(
                          "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all",
                          isSelected ? "border-slate-700 bg-slate-700" : "border-slate-300"
                        )}>
                          {isSelected && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>

                        {/* Repo info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono text-slate-800 truncate">{r.fullName}</p>
                          {r.updatedAt && (
                            <p className="text-[10px] text-slate-400 mt-0.5">Updated {formatDate(r.updatedAt)}</p>
                          )}
                        </div>

                        {/* Private/Public badge */}
                        <div className={cn(
                          "shrink-0 flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
                          r.private
                            ? "text-amber-600 bg-amber-50 border-amber-200"
                            : "text-slate-400 bg-slate-50 border-slate-200"
                        )}>
                          {r.private ? <LockIcon className="w-2.5 h-2.5" /> : <GlobeIcon className="w-2.5 h-2.5" />}
                          {r.private ? "Private" : "Public"}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <p className="text-[11px] text-slate-400 mb-4">
                {selected.size} repo{selected.size !== 1 ? "s" : ""} selected
              </p>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 mb-4">
                  <svg className="w-3.5 h-3.5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-red-600">{error}</p>
                </div>
              )}

              <button
                onClick={handleSaveRepos}
                disabled={saving || selected.size === 0}
                className="w-full flex items-center justify-center gap-2 h-10 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm rounded-xl transition-colors shadow-sm"
              >
                {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {saving ? "Saving…" : `Save ${selected.size > 0 ? `${selected.size} ` : ""}Repo${selected.size !== 1 ? "s" : ""}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
