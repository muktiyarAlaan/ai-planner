import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sequelize } from "@/lib/sequelize";
import { Plan } from "@/models/Plan";
import { formatDate } from "@/lib/utils";

async function getPlan(id: string, userId: string) {
  try {
    await sequelize.authenticate();
    const plan = await Plan.findOne({ where: { id, userId } });
    return plan?.toJSON() ?? null;
  } catch {
    return null;
  }
}

interface PageProps {
  params: { id: string };
}

export default async function PlanPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return notFound();

  const plan = await getPlan(params.id, session.user.id);
  if (!plan) return notFound();

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[#52525b] mb-6">
        <Link href="/dashboard" className="hover:text-[#a1a1aa] transition-colors">
          Dashboard
        </Link>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-[#71717a] truncate max-w-xs">{plan.title}</span>
      </div>

      {/* Plan header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">
              {plan.title}
            </h1>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-xs text-[#52525b] font-mono bg-[#151515] px-1.5 py-0.5 rounded border border-[#1f1f1f]">
                {plan.model}
              </span>
              <span className="text-xs text-[#52525b]">
                Created {formatDate(plan.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Plan content placeholder */}
      <div className="space-y-4">
        <div className="bg-[#111] border border-[#1f1f1f] rounded-xl p-6">
          <h2 className="text-sm font-medium text-[#a1a1aa] mb-3">Original Requirement</h2>
          <p className="text-sm text-[#71717a] leading-relaxed whitespace-pre-wrap">
            {plan.rawRequirement}
          </p>
        </div>

        {/* Phase 2 sections */}
        {[
          { label: "Requirements", key: "requirements" },
          { label: "Entity Relationship Diagram", key: "entities" },
          { label: "User Flows", key: "userFlows" },
          { label: "API Endpoints", key: "apiEndpoints" },
        ].map(({ label, key }) => (
          <div
            key={key}
            className="bg-[#111] border border-[#1f1f1f] rounded-xl p-6"
          >
            <h2 className="text-sm font-medium text-[#a1a1aa] mb-3">{label}</h2>
            {plan[key as keyof typeof plan] ? (
              <pre className="text-xs text-[#71717a] font-mono overflow-auto">
                {JSON.stringify(plan[key as keyof typeof plan], null, 2)}
              </pre>
            ) : (
              <div className="flex items-center gap-2 text-xs text-[#3f3f46]">
                <div className="w-1 h-1 rounded-full bg-[#333]" />
                Not yet generated — Phase 2 coming soon
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
