"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function OnboardingPage() {
  const router = useRouter();
  const { update } = useSession();
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/user/claude-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      // Refresh session to pick up the new key
      await update();
      router.push("/dashboard");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-10 justify-center">
          <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M2 4h12M2 8h8M2 12h10"
                stroke="#0a0a0a"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">
            Alaan Planner
          </span>
        </div>

        <div className="bg-[#111] border border-[#222] rounded-xl p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="w-10 h-10 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center justify-center mb-4">
              <svg
                className="w-5 h-5 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-white mb-1">
              Connect your Claude account
            </h1>
            <p className="text-sm text-[#71717a] leading-relaxed">
              Your API key is encrypted and only used to generate plans on your
              behalf. We never store it in plaintext.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="apiKey" className="text-[#a1a1aa] text-xs font-medium uppercase tracking-wide">
                Anthropic API Key
              </Label>
              <div className="relative">
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="sk-ant-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pr-10 font-mono text-sm"
                  autoComplete="off"
                  spellCheck={false}
                />
                {apiKey && (
                  <button
                    type="button"
                    onClick={() => setApiKey("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#52525b] hover:text-[#a1a1aa] transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2.5">
                <svg
                  className="w-4 h-4 text-red-400 mt-0.5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-10"
              disabled={isLoading || !apiKey.trim()}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin mr-2" />
                  Validating key…
                </>
              ) : (
                "Connect API Key"
              )}
            </Button>
          </form>

          {/* How to get your API key */}
          <div className="mt-6 border-t border-[#1f1f1f] pt-5">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center justify-between w-full text-left group"
            >
              <span className="text-xs font-medium text-[#71717a] group-hover:text-[#a1a1aa] transition-colors">
                How to get your API key
              </span>
              <svg
                className={`w-3.5 h-3.5 text-[#52525b] transition-transform duration-200 ${
                  isExpanded ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {isExpanded && (
              <div className="mt-4 space-y-3">
                {[
                  {
                    step: 1,
                    text: (
                      <>
                        Go to{" "}
                        <a
                          href="https://console.anthropic.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-400 hover:text-green-300 underline underline-offset-2"
                        >
                          console.anthropic.com
                        </a>
                        {" "}and sign in
                      </>
                    ),
                  },
                  {
                    step: 2,
                    text: 'Click "API Keys" in the left sidebar',
                  },
                  {
                    step: 3,
                    text: 'Click "Create Key" and give it a name',
                  },
                  {
                    step: 4,
                    text: "Copy the key (starts with sk-ant-) and paste it above",
                  },
                  {
                    step: 5,
                    text: "Make sure your account has billing set up and credits available",
                  },
                ].map(({ step, text }) => (
                  <div key={step} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#1a1a1a] border border-[#333] flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] text-[#71717a] font-mono">
                        {step}
                      </span>
                    </div>
                    <p className="text-xs text-[#71717a] leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-[#3f3f46] mt-6">
          Your key is encrypted with AES-256-GCM before storage.
        </p>
      </div>
    </div>
  );
}
