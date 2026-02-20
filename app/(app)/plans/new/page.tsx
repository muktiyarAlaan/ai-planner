import Link from "next/link";

export default function NewPlanPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-[#52525b] mb-4">
          <Link href="/dashboard" className="hover:text-[#a1a1aa] transition-colors">
            Dashboard
          </Link>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-[#71717a]">New Plan</span>
        </div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">
          New Plan
        </h1>
        <p className="text-sm text-[#71717a] mt-1">
          Describe your feature requirement in plain English.
        </p>
      </div>

      {/* Phase 2 placeholder */}
      <div className="bg-[#111] border border-[#1f1f1f] rounded-xl p-8 text-center">
        <div className="w-12 h-12 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-6 h-6 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
        </div>
        <h2 className="text-base font-medium text-white mb-2">
          Plan Generation — Coming in Phase 2
        </h2>
        <p className="text-sm text-[#71717a] max-w-sm mx-auto leading-relaxed">
          This page will feature the AI-powered plan generation interface with
          requirements extraction, ERD generation, user flows, and API spec
          design using Claude.
        </p>
        <div className="mt-6 flex flex-col items-center gap-2">
          {[
            "Q&A context gathering",
            "Requirements specification",
            "Entity Relationship Diagram (React Flow)",
            "User flow diagrams",
            "API endpoint design",
            "Linear ticket creation",
          ].map((feature) => (
            <div key={feature} className="flex items-center gap-2 text-xs text-[#52525b]">
              <div className="w-1 h-1 rounded-full bg-[#333]" />
              {feature}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
