"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";

type Tab = "account" | "integrations";

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

  const tabs: { id: Tab; label: string }[] = [
    { id: "account", label: "Account" },
    { id: "integrations", label: "Integrations" },
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
              "px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px",
              tab === t.id
                ? "border-violet-600 text-violet-700"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            )}
          >
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
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
              <GithubLogo className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="text-sm font-semibold text-slate-900">GitHub</h3>
                {user?.hasGithubToken ? (
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
                {user?.hasGithubToken
                  ? `${user.githubRepos?.length ?? 0} repo${(user.githubRepos?.length ?? 0) !== 1 ? "s" : ""} connected — AI will use your codebase as context.`
                  : "Connect a GitHub repo so AI-generated plans use your actual codebase as context."}
              </p>
            </div>
            <Link
              href="/settings/integrations/github"
              className="shrink-0 h-8 px-3.5 flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-lg transition-all"
            >
              {user?.hasGithubToken ? "Configure" : "Connect"}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
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
    </div>
  );
}
