"use client";

import { useState } from "react";

interface Props {
  planId: string;
  initialIsShared: boolean;
  initialShareToken: string | null;
  onClose: () => void;
}

export function ShareModal({ planId, initialIsShared, initialShareToken, onClose }: Props) {
  const [isShared, setIsShared] = useState(initialIsShared);
  const [shareUrl, setShareUrl] = useState<string | null>(
    initialIsShared && initialShareToken
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/shared/${initialShareToken}`
      : null
  );
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enableSharing() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/plans/${planId}/share`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create share link");
      setShareUrl(data.shareUrl);
      setIsShared(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function disableSharing() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/plans/${planId}/share`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to disable sharing");
      }
      setShareUrl(null);
      setIsShared(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function copyLink() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Modal */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#f5f3ff] rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-[#7C3AED]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </div>
            <h2 className="text-[15px] font-bold text-[#0f172a]">Share Plan</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#94a3b8] hover:text-[#64748b] hover:bg-[#f1f5f9] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-[12px] text-red-600">{error}</p>
          </div>
        )}

        {isShared && shareUrl ? (
          /* ── Sharing enabled ── */
          <div className="space-y-4">
            <div>
              <p className="text-[12px] font-medium text-[#374151] mb-2">Shareable link</p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  className="flex-1 min-w-0 text-[12px] font-mono text-[#374151] bg-[#f8fafc] border border-[#e2e8f0] rounded-lg px-3 py-2 focus:outline-none"
                />
                <button
                  onClick={copyLink}
                  className={`flex items-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-lg transition-colors shrink-0 ${
                    copied
                      ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                      : "bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
                  }`}
                >
                  {copied ? (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            <p className="text-[11px] text-[#94a3b8] flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Anyone with this link can view this plan (read-only)
            </p>

            <div className="pt-3 border-t border-[#f1f5f9]">
              <button
                onClick={disableSharing}
                disabled={loading}
                className="flex items-center gap-1.5 text-[12px] font-medium text-red-600 hover:text-red-700 disabled:opacity-50 transition-colors"
              >
                {loading ? (
                  <div className="w-3.5 h-3.5 border border-red-300 border-t-red-600 rounded-full animate-spin" />
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                )}
                Disable link
              </button>
            </div>
          </div>
        ) : (
          /* ── Sharing not enabled ── */
          <div className="space-y-4">
            <p className="text-[13px] text-[#64748b] leading-relaxed">
              Create a shareable link so anyone can view this plan without signing in.
            </p>

            <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4 space-y-2">
              {[
                "Read-only access — no editing",
                "All tabs visible: Requirements, Entities, APIs, Flows, Security",
                "Disable the link at any time",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-[12px] text-[#374151]">{item}</span>
                </div>
              ))}
            </div>

            <button
              onClick={enableSharing}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 text-white font-medium text-sm px-4 py-2.5 rounded-lg transition-colors"
            >
              {loading ? (
                <div className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              )}
              {loading ? "Creating link…" : "Create shareable link"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
