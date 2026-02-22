"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup, getIdToken } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

const FEATURES = [
  { label: "Requirements & User Stories",  path: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { label: "Entity & ERD Diagrams",         path: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" },
  { label: "User Flow Canvas",              path: "M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" },
  { label: "API Specifications",            path: "M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { label: "Security Review & Threats",     path: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
  { label: "CLAUDE.md Context File",        path: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" },
];

export default function LoginPage() {
  const router    = useRouter();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const result  = await signInWithPopup(auth, googleProvider);
      const idToken = await getIdToken(result.user);
      const res     = await fetch("/api/auth/session", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ idToken }),
      });
      if (!res.ok) { setError("Sign-in failed. Please try again."); return; }
      const data = await res.json();
      router.push(data.hasLinearToken ? "/dashboard" : "/onboarding");
    } catch {
      setError("Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Left: branding panel ── */}
      <div className="hidden lg:flex lg:w-[52%] bg-[#0c1222] relative overflow-hidden flex-col justify-between p-12 select-none">

        {/* Background glow blobs */}
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 right-0 w-[400px] h-[400px] bg-violet-700/8 rounded-full blur-3xl pointer-events-none" />
        {/* Subtle dot grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.035]"
          style={{
            backgroundImage: "radial-gradient(circle, #a5b4fc 1px, transparent 1px)",
            backgroundSize:  "32px 32px",
          }}
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M2 4h12M2 8h8M2 12h10" stroke="#0c1222" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <span className="text-white font-bold text-sm tracking-tight">Alaan Planner</span>
        </div>

        {/* Hero copy */}
        <div className="relative z-10">
          <p className="text-indigo-400/70 text-[11px] font-bold uppercase tracking-widest mb-5">
            AI-Powered Engineering Planning
          </p>
          <h1 className="text-white text-[2rem] font-bold leading-tight tracking-tight mb-5">
            Turn requirements<br />
            into engineering plans<br />
            <span className="text-indigo-300">in seconds.</span>
          </h1>
          <p className="text-slate-400 text-[13px] leading-relaxed max-w-xs mb-10">
            Describe a feature in plain English. Get a fully structured technical plan — ERD, user flows, API specs, security review, and more.
          </p>

          {/* Feature grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {FEATURES.map((f) => (
              <div key={f.label} className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-md bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d={f.path} />
                  </svg>
                </div>
                <span className="text-slate-300 text-[12px] leading-tight">{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center gap-2">
          {/* Gemini sparkle */}
          <svg className="w-3.5 h-3.5 text-indigo-400/60" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74z" />
          </svg>
          <span className="text-slate-600 text-[11px]">Powered by Gemini AI</span>
        </div>
      </div>

      {/* ── Right: auth panel ── */}
      <div className="flex-1 bg-[#f8f9fc] flex items-center justify-center px-8 py-12">
        <div className="w-full max-w-[360px]">

          {/* Mobile-only logo */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="w-8 h-8 bg-[#0c1222] rounded-lg flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M2 8h8M2 12h10" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-[#0f172a] font-bold text-base tracking-tight">Alaan Planner</span>
          </div>

          {/* Auth card */}
          <div className="bg-white border border-[#e8eaf0] rounded-2xl p-8 shadow-sm">
            {/* Heading */}
            <div className="mb-7">
              <h2 className="text-[22px] font-bold text-[#0f172a] tracking-tight mb-1.5">
                Welcome back
              </h2>
              <p className="text-[13px] text-[#64748b]">
                Sign in to continue to Alaan Planner
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-5 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3.5 py-3">
                <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            {/* Google sign-in */}
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 h-11 bg-white border border-[#e2e8f0] hover:border-[#7C3AED]/40 hover:bg-[#fafbff] text-[#0f172a] font-medium text-sm rounded-xl transition-all shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-[#cbd5e1] border-t-[#7C3AED] rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              {loading ? "Signing in…" : "Continue with Google"}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-[#f1f5f9]" />
              <span className="text-[11px] text-[#cbd5e1] font-medium">secure sign-in</span>
              <div className="flex-1 h-px bg-[#f1f5f9]" />
            </div>

            {/* Trust pills */}
            <div className="flex items-center justify-center gap-2">
              {[
                { icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z", label: "Encrypted keys" },
                { icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", label: "Never shared" },
                { icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z", label: "No card needed" },
              ].map((t) => (
                <div key={t.label} className="flex items-center gap-1.5 bg-[#f8fafc] border border-[#f1f5f9] rounded-full px-2.5 py-1">
                  <svg className="w-3 h-3 text-[#94a3b8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={t.icon} />
                  </svg>
                  <span className="text-[10px] text-[#94a3b8] font-medium whitespace-nowrap">{t.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer note */}
          <p className="text-[11px] text-[#94a3b8] text-center mt-4">
            Your API keys are encrypted and never shared.
          </p>
        </div>
      </div>
    </div>
  );
}
