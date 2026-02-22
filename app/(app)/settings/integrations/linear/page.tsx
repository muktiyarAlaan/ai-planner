"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";

interface LinearTeam { id: string; name: string; key: string; }

function LinearLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M.958 11.295a7.8 7.8 0 0 0 3.747 3.747L.958 11.295ZM.006 8.735l7.259 7.259a8.08 8.08 0 0 1-1.246.006L.006 8.735Zm0-1.44L9.44 16H8.03L0 7.97V7.295Zm1.24-3.056L11.87 14.76a7.9 7.9 0 0 1-1.44.96L1.2 6.176a7.9 7.9 0 0 1 .96-1.44h-.914Zm2.434-2.433L14.309 12.327a7.85 7.85 0 0 1-.914.96L2.681 2.572a7.85 7.85 0 0 1 .96-.914L3.68 2.806Zm2.88-1.473c.378.106.747.24 1.106.397L15.27 9.334a7.73 7.73 0 0 1-.397-1.106L6.56 1.333ZM9.12.248l6.632 6.632a7.8 7.8 0 0 0-3.747-3.747L9.12.248Z" />
    </svg>
  );
}

export default function LinearSettingsPage() {
  const { user } = useAuth();

  const [step,          setStep]          = useState<1 | 2>(1);
  const [token,         setToken]         = useState("");
  const [teams,         setTeams]         = useState<LinearTeam[]>([]);
  const [selectedTeam,  setSelectedTeam]  = useState<LinearTeam | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");

  const isConnected = !!user?.hasLinearToken;

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res  = await fetch("/api/user/linear-token", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong."); return; }
      setWorkspaceName(data.workspaceName ?? "Linear");
      setTeams(data.teams ?? []);
      setStep(2);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveTeam() {
    if (!selectedTeam) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/user/linear-team", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ teamId: selectedTeam.id }),
      });
      if (!res.ok) { setError("Failed to save team."); return; }
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
      const res = await fetch("/api/user/linear-token", { method: "DELETE" });
      if (!res.ok) { setError("Failed to disconnect."); return; }
      window.location.href = "/settings";
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="max-w-[480px] mx-auto px-4 py-10">
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
        <div className="w-10 h-10 bg-[#5e6ad2] rounded-xl flex items-center justify-center shrink-0">
          <LinearLogo className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Linear</h1>
          <p className="text-xs text-slate-500">Push tickets directly from plans to your workspace.</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-[#5e6ad2] to-[#818cf8]" />
        <div className="p-7">

          {/* ── Already connected view ── */}
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
              <h2 className="text-base font-semibold text-slate-900 mb-1.5">Linear is connected</h2>
              <p className="text-sm text-slate-500 mb-6">
                Your workspace is linked. Plans can push tickets to Linear automatically.
              </p>
              <p className="text-xs text-slate-400 mb-6">
                Want to switch workspaces? Disconnect first, then reconnect with the new API key.
              </p>

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
                <h2 className="text-base font-semibold text-slate-900 mb-1">Add your API Key</h2>
                <p className="text-sm text-slate-500">
                  Generate a Personal API key from your Linear workspace settings.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  Personal API Key
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="lin_api_..."
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full h-10 bg-white border border-slate-200 rounded-xl px-3.5 pr-9 text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#5e6ad2]/50 focus:ring-2 focus:ring-[#5e6ad2]/10 transition-all"
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
                className="w-full flex items-center justify-center gap-2 h-10 bg-[#5e6ad2] hover:bg-[#4c58c0] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm rounded-xl transition-colors shadow-sm"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <LinearLogo className="w-3.5 h-3.5" />
                )}
                {loading ? "Connecting…" : "Connect Linear"}
              </button>
            </form>
          )}

          {/* ── Step 2: Team selection ── */}
          {step === 2 && (
            <>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-5 h-5 bg-emerald-400 rounded-full flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-xs text-emerald-700 font-medium bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full">
                  Connected as {workspaceName}
                </span>
              </div>
              <h2 className="text-base font-semibold text-slate-900 mb-1">Which team should we use?</h2>
              <p className="text-sm text-slate-500 mb-5">Issues from your plans will be created under this team.</p>

              {teams.length === 0 ? (
                <div className="py-8 text-center bg-slate-50 rounded-xl border border-slate-100 mb-5">
                  <p className="text-sm text-slate-400">No teams found in your workspace.</p>
                </div>
              ) : (
                <div className="space-y-2 mb-5 max-h-[280px] overflow-y-auto">
                  {teams.map((team) => {
                    const isSelected = selectedTeam?.id === team.id;
                    return (
                      <button
                        key={team.id}
                        onClick={() => setSelectedTeam(team)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left transition-all",
                          isSelected
                            ? "bg-[#5e6ad2]/5 border-[#5e6ad2]/40 ring-1 ring-[#5e6ad2]/10"
                            : "bg-white border-slate-200 hover:border-[#5e6ad2]/30 hover:bg-[#fafbff]"
                        )}
                      >
                        <div className={cn(
                          "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                          isSelected ? "border-[#5e6ad2] bg-[#5e6ad2]" : "border-slate-300"
                        )}>
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-[#5e6ad2]/10 border border-[#5e6ad2]/20 flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-[#5e6ad2] uppercase">{team.key.slice(0, 3)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{team.name}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{team.key}</p>
                        </div>
                        {isSelected && (
                          <svg className="w-4 h-4 text-[#5e6ad2] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 mb-4">
                  <svg className="w-3.5 h-3.5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-red-600">{error}</p>
                </div>
              )}

              <button
                onClick={handleSaveTeam}
                disabled={!selectedTeam || saving}
                className="w-full flex items-center justify-center gap-2 h-10 bg-[#5e6ad2] hover:bg-[#4c58c0] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm rounded-xl transition-colors shadow-sm"
              >
                {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {saving ? "Saving…" : "Save & Finish"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
