"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Question {
  id: string;
  question: string;
  type: "MULTI_CHOICE" | "FREE_TEXT";
  options?: string[];
}

interface PodOption {
  podName: string;
  title: string;
}

const GENERATING_PHASES = [
  { label: "Analyzing requirements…",  icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { label: "Designing entities…",       icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" },
  { label: "Mapping user flows…",       icon: "M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" },
  { label: "Speccing APIs…",            icon: "M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { label: "Assembling plan…",          icon: "M13 10V3L4 14h7v7l9-11h-7z" },
];

export default function NewPlanPage() {
  const router = useRouter();

  const [step,               setStep]               = useState<"input" | "questions">("input");
  const [requirement,        setRequirement]        = useState("");
  const [context,            setContext]            = useState("");
  const [showContext,        setShowContext]        = useState(false);
  const [selectedPods,       setSelectedPods]       = useState<string[]>([]);
  const [isPodMenuOpen,      setIsPodMenuOpen]      = useState(false);
  const [pods,               setPods]               = useState<PodOption[]>([]);
  const [loadingQuestions,   setLoadingQuestions]   = useState(false);
  const [questionsError,     setQuestionsError]     = useState("");
  const [questions,          setQuestions]          = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOptions,    setSelectedOptions]    = useState<Record<string, string>>({});
  const [customAnswers,      setCustomAnswers]      = useState<Record<string, string>>({});
  const [freeTextAnswers,    setFreeTextAnswers]    = useState<Record<string, string>>({});
  const [generating,         setGenerating]         = useState(false);
  const [generatingPhase,    setGeneratingPhase]    = useState(0);
  const [generateError,      setGenerateError]      = useState("");

  // Cancel pending auto-advance if the user changes their answer
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const podMenuRef = useRef<HTMLDivElement | null>(null);

  // Fetch available pods on mount
  useEffect(() => {
    fetch("/api/agent-context/pods")
      .then((r) => r.json())
      .then((data) => {
        const podList = (data.pods ?? []) as { podName: string; title: string }[];
        setPods(podList.map((p) => ({ podName: p.podName, title: p.title })));
      })
      .catch(() => {/* silently ignore if pods unavailable */});
  }, []);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!podMenuRef.current) return;
      if (!podMenuRef.current.contains(event.target as Node)) {
        setIsPodMenuOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsPodMenuOpen(false);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    const availablePods = new Set(pods.map((pod) => pod.podName));
    setSelectedPods((prev) => prev.filter((podName) => availablePods.has(podName)));
  }, [pods]);

  function togglePodSelection(podName: string) {
    setSelectedPods((prev) =>
      prev.includes(podName) ? prev.filter((pod) => pod !== podName) : [...prev, podName]
    );
  }

  function getAnswer(q: Question): string {
    if (q.type === "FREE_TEXT") return freeTextAnswers[q.id] ?? "";
    const selected = selectedOptions[q.id];
    if (!selected) return "";
    if (selected === "Something else") return customAnswers[q.id] ?? "";
    return selected;
  }

  const currentQuestion = questions[currentQuestionIndex];
  const currentAnswer   = currentQuestion ? getAnswer(currentQuestion).trim() : "";
  const isLastQuestion  = currentQuestionIndex === questions.length - 1;

  // Select a multi-choice option and auto-advance if not last question / not "Something else"
  function selectOption(questionId: string, option: string, questionIndex: number) {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);

    setSelectedOptions((prev) => ({ ...prev, [questionId]: option }));
    if (option !== "Something else") {
      setCustomAnswers((prev) => ({ ...prev, [questionId]: "" }));
      const isLast = questionIndex === questions.length - 1;
      if (!isLast) {
        advanceTimer.current = setTimeout(() => {
          setCurrentQuestionIndex((i) => i + 1);
        }, 320);
      }
    }
  }

  async function handleContinue() {
    if (!requirement.trim()) return;
    setLoadingQuestions(true);
    setQuestionsError("");
    try {
      const res  = await fetch("/api/ai/questions", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          requirement,
          context,
          selectedPods: selectedPods.length > 0 ? selectedPods : null,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setQuestions(data.questions);
      setCurrentQuestionIndex(0);
      setStep("questions");
    } catch (err) {
      setQuestionsError(err instanceof Error ? err.message : "Failed to generate questions");
    } finally {
      setLoadingQuestions(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setGenerateError("");
    setGeneratingPhase(0);

    let phase = 0;
    const interval = setInterval(() => {
      phase++;
      if (phase < GENERATING_PHASES.length) setGeneratingPhase(phase);
    }, 2500);

    try {
      const answers = questions.map((q) => ({
        questionId: q.id,
        question:   q.question,
        answer:     getAnswer(q),
      }));
      const res  = await fetch("/api/ai/generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          requirement,
          context,
          answers,
          selectedPods: selectedPods.length > 0 ? selectedPods : null,
        }),
      });
      const data = await res.json();
      clearInterval(interval);
      if (data.error) throw new Error(data.error);
      router.push(`/plans/${data.planId}`);
    } catch (err) {
      clearInterval(interval);
      setGenerating(false);
      setGenerateError(err instanceof Error ? err.message : "Failed to generate plan");
    }
  }

  return (
    <>
      {/* ── Generating overlay ─────────────────────────────────────────────── */}
      {generating && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-xl px-10 py-10 w-full max-w-sm mx-6 text-center">

            {/* Icon */}
            <div className="relative mx-auto mb-6 w-14 h-14">
              <div className="absolute inset-0 rounded-xl bg-[#7C3AED]/10 animate-pulse" />
              <div className="relative w-14 h-14 bg-[#7C3AED] rounded-xl flex items-center justify-center shadow-md shadow-[#7C3AED]/20">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>

            <p className="text-base font-bold text-[#0f172a] mb-1">
              {GENERATING_PHASES[generatingPhase].label}
            </p>
            <p className="text-xs text-[#94a3b8] mb-7">
              Building your technical plan with Gemini AI
            </p>

            {/* Phase checklist */}
            <div className="space-y-2 text-left">
              {GENERATING_PHASES.map((phase, i) => {
                const done   = i < generatingPhase;
                const active = i === generatingPhase;
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-3 text-[13px] transition-all duration-400 px-3 py-2 rounded-lg",
                      active ? "bg-[#f5f3ff]" : ""
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all duration-300",
                      done   ? "bg-emerald-100"
                             : active ? "bg-[#7C3AED]"
                             : "bg-[#f1f5f9]"
                    )}>
                      {done ? (
                        <svg className="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : active ? (
                        <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-[#d1d5db]" />
                      )}
                    </div>
                    <span className={cn(
                      "transition-colors",
                      done   ? "text-[#94a3b8]"
                             : active ? "text-[#7C3AED] font-medium"
                             : "text-[#d1d5db]"
                    )}>
                      {phase.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="p-8 max-w-3xl mx-auto">
        {/* ── Header ── */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-[#94a3b8] mb-4">
            <Link href="/dashboard" className="hover:text-[#64748b] transition-colors">Dashboard</Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-[#64748b]">New Plan</span>
          </div>
          <h1 className="text-2xl font-bold text-[#0f172a] tracking-tight">
            {step === "input" ? "New Plan" : "Clarifying Questions"}
          </h1>
          <p className="text-sm text-[#64748b] mt-1">
            {step === "input"
              ? "Describe your feature requirement and we\u2019ll generate a complete technical plan."
              : "Answer a few questions so we can tailor the plan to your needs."}
          </p>
        </div>

        {/* ── Step 1: Requirement Input ── */}
        {step === "input" && (
          <div className="space-y-4">
            <textarea
              value={requirement}
              onChange={(e) => setRequirement(e.target.value)}
              placeholder="e.g. Add multi-currency support to billpay, or Build a session management page where users can see and revoke active sessions"
              rows={6}
              className="w-full bg-white border border-[#cbd5e1] rounded-xl px-4 py-3 text-sm text-[#0f172a] placeholder-[#94a3b8] resize-none focus:outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/10 transition-colors"
            />

            {/* Pod selection */}
            <div ref={podMenuRef} className="relative">
              <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1.5">
                Pod <span className="font-normal normal-case text-[#94a3b8]">(optional)</span>
              </label>
              <button
                type="button"
                onClick={() => setIsPodMenuOpen((prev) => !prev)}
                className={cn(
                  "w-full min-h-11 bg-white border rounded-xl px-3.5 py-2 text-left text-sm transition-colors",
                  "focus:outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/10",
                  isPodMenuOpen ? "border-[#7C3AED]" : "border-[#cbd5e1]"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {selectedPods.length === 0 ? (
                      <span className="text-[#94a3b8]">Not pod-specific</span>
                    ) : (
                      selectedPods.map((podName) => (
                        <span
                          key={podName}
                          className="inline-flex items-center rounded-md bg-[#eef2ff] text-[#4f46e5] border border-[#c7d2fe] px-2 py-0.5 text-xs font-medium"
                        >
                          {podName}
                        </span>
                      ))
                    )}
                  </div>
                  <svg
                    className={cn("w-4 h-4 text-[#94a3b8] transition-transform", isPodMenuOpen && "rotate-180")}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              {isPodMenuOpen && (
                <div className="absolute z-20 mt-2 w-full rounded-2xl border border-[#e2e8f0] bg-white shadow-[0_20px_50px_-24px_rgba(15,23,42,0.45)]">
                  <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#f1f5f9]">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#64748b]">Select pods</p>
                    <button
                      type="button"
                      onClick={() => setSelectedPods([])}
                      disabled={selectedPods.length === 0}
                      className="text-xs text-[#64748b] hover:text-[#0f172a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                  {pods.length === 0 ? (
                    <p className="px-3.5 py-3 text-sm text-[#94a3b8]">No pods configured yet.</p>
                  ) : (
                    <div className="max-h-56 overflow-auto py-1.5">
                      {pods.map((pod) => {
                        const isSelected = selectedPods.includes(pod.podName);
                        return (
                          <button
                            key={pod.podName}
                            type="button"
                            onClick={() => togglePodSelection(pod.podName)}
                            className={cn(
                              "w-full flex items-start gap-3 px-3.5 py-2.5 text-left transition-colors",
                              isSelected ? "bg-[#f5f3ff]" : "hover:bg-[#f8fafc]"
                            )}
                          >
                            <span
                              className={cn(
                                "mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                                isSelected ? "bg-[#7C3AED] border-[#7C3AED]" : "border-[#cbd5e1] bg-white"
                              )}
                            >
                              {isSelected && (
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-[#0f172a]">{pod.podName}</span>
                              {pod.title && pod.title !== pod.podName && (
                                <span className="block text-xs text-[#94a3b8] mt-0.5">{pod.title}</span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              <p className="mt-1.5 text-[11px] text-[#94a3b8]">
                Select one or more pods to include their context in question and plan generation.
              </p>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setShowContext(!showContext)}
                className="flex items-center gap-1.5 text-sm text-[#64748b] hover:text-[#374151] transition-colors"
              >
                <svg className={cn("w-3.5 h-3.5 transition-transform", showContext && "rotate-90")}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Additional context (optional)
              </button>

              {showContext && (
                <div className="mt-2">
                  <textarea
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="Paste relevant schema, service names, constraints, existing API snippets..."
                    rows={4}
                    className="w-full bg-white border border-[#cbd5e1] rounded-xl px-4 py-3 text-sm text-[#0f172a] placeholder-[#94a3b8] resize-none focus:outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/10 transition-colors"
                  />
                </div>
              )}
            </div>

            {questionsError && <p className="text-sm text-red-500">{questionsError}</p>}

            <button
              onClick={handleContinue}
              disabled={!requirement.trim() || loadingQuestions}
              className="flex items-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm px-5 py-2.5 rounded-lg transition-colors shadow-sm"
            >
              {loadingQuestions ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating questions…
                </>
              ) : (
                <>
                  Continue
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        )}

        {/* ── Step 2: Question Slides ── */}
        {step === "questions" && currentQuestion && (
          <div className="space-y-4">
            {/* Requirement summary */}
            <div className="bg-white border border-[#e2e8f0] rounded-xl px-4 py-3 flex items-start gap-3">
              <div className="w-1 self-stretch bg-[#7C3AED]/30 rounded-full shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-[#94a3b8] uppercase tracking-wider font-semibold mb-0.5">
                  Requirement
                </p>
                <p className="text-sm text-[#374151] leading-relaxed line-clamp-2">{requirement}</p>
                {selectedPods.length > 0 && (
                  <p className="text-[11px] text-[#7C3AED] mt-0.5 font-medium">
                    Pods: {selectedPods.join(", ")}
                  </p>
                )}
              </div>
              <button
                onClick={() => setStep("input")}
                className="text-[11px] text-[#94a3b8] hover:text-[#64748b] transition-colors shrink-0 mt-0.5"
              >
                Edit
              </button>
            </div>

            {/* Question card */}
            <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden">
              {/* Flush progress bar at top */}
              <div className="h-1 bg-[#f1f5f9]">
                <div
                  className="h-full bg-[#7C3AED] transition-all duration-500 ease-out"
                  style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                />
              </div>

              <div className="p-6 space-y-5">
                {/* Step label + dot indicators */}
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-[#94a3b8] uppercase tracking-wider font-semibold">
                    Question {currentQuestionIndex + 1} of {questions.length}
                  </p>
                  <div className="flex items-center gap-1.5">
                    {questions.map((q, i) => (
                      <div
                        key={i}
                        className={cn(
                          "rounded-full transition-all duration-300",
                          i === currentQuestionIndex
                            ? "w-4 h-1.5 bg-[#7C3AED]"
                            : getAnswer(q).trim().length > 0
                            ? "w-1.5 h-1.5 bg-[#7C3AED]/35"
                            : "w-1.5 h-1.5 bg-[#e2e8f0]"
                        )}
                      />
                    ))}
                  </div>
                </div>

                {/* Question text */}
                <p className="text-[15px] font-semibold text-[#0f172a] leading-snug">
                  {currentQuestion.question}
                </p>

                {/* Multi-choice: full-width selectable cards */}
                {currentQuestion.type === "MULTI_CHOICE" && currentQuestion.options && (
                  <div className="space-y-2">
                    {currentQuestion.options.map((option) => {
                      const isSelected = selectedOptions[currentQuestion.id] === option;
                      return (
                        <button
                          key={option}
                          onClick={() => selectOption(currentQuestion.id, option, currentQuestionIndex)}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-150",
                            isSelected
                              ? "bg-[#7C3AED]/5 border-[#7C3AED]/50 text-[#7C3AED]"
                              : "bg-white border-[#e2e8f0] text-[#374151] hover:border-[#7C3AED]/30 hover:bg-[#fafbff]"
                          )}
                        >
                          {/* Radio circle */}
                          <div className={cn(
                            "w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all duration-150",
                            isSelected ? "border-[#7C3AED] bg-[#7C3AED]" : "border-[#d1d5db]"
                          )}>
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <span className="text-sm font-medium">{option}</span>
                        </button>
                      );
                    })}

                    {/* "Something else" free text */}
                    {selectedOptions[currentQuestion.id] === "Something else" && (
                      <textarea
                        value={customAnswers[currentQuestion.id] ?? ""}
                        onChange={(e) =>
                          setCustomAnswers((prev) => ({ ...prev, [currentQuestion.id]: e.target.value }))
                        }
                        placeholder="Describe your specific situation…"
                        rows={2}
                        autoFocus
                        className="w-full bg-white border border-[#7C3AED]/40 rounded-xl px-4 py-3 text-sm text-[#0f172a] placeholder-[#94a3b8] resize-none focus:outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/10 transition-colors mt-1"
                      />
                    )}
                  </div>
                )}

                {/* Free-text */}
                {currentQuestion.type === "FREE_TEXT" && (
                  <textarea
                    value={freeTextAnswers[currentQuestion.id] ?? ""}
                    onChange={(e) =>
                      setFreeTextAnswers((prev) => ({ ...prev, [currentQuestion.id]: e.target.value }))
                    }
                    placeholder="Your answer…"
                    rows={3}
                    className="w-full bg-white border border-[#cbd5e1] rounded-xl px-4 py-3 text-sm text-[#0f172a] placeholder-[#94a3b8] resize-none focus:outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/10 transition-colors"
                  />
                )}

                {/* Navigation */}
                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() => {
                      if (advanceTimer.current) clearTimeout(advanceTimer.current);
                      if (currentQuestionIndex === 0) setStep("input");
                      else setCurrentQuestionIndex((i) => i - 1);
                    }}
                    className="flex items-center gap-1.5 text-sm text-[#64748b] hover:text-[#374151] transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                  </button>

                  {isLastQuestion ? (
                    <button
                      onClick={handleGenerate}
                      disabled={!currentAnswer || generating}
                      className="flex items-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm px-5 py-2.5 rounded-lg transition-colors shadow-sm"
                    >
                      Generate Plan
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      onClick={() => setCurrentQuestionIndex((i) => i + 1)}
                      disabled={!currentAnswer}
                      className="flex items-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm px-5 py-2.5 rounded-lg transition-colors shadow-sm"
                    >
                      Next
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {generateError && <p className="text-sm text-red-500">{generateError}</p>}
          </div>
        )}
      </div>
    </>
  );
}
