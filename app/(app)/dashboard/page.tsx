import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { sequelize } from "@/lib/sequelize";
import { Plan } from "@/models/Plan";
import Link from "next/link";
import { formatRelativeDate } from "@/lib/utils";

async function getUserPlans(userId: string) {
  try {
    await sequelize.authenticate();
    const plans = await Plan.findAll({
      where: { userId },
      order: [["createdAt", "DESC"]],
      attributes: ["id", "title", "model", "createdAt", "updatedAt"],
    });
    return plans.map((p) => p.toJSON());
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) redirect("/login");
  if (!session.user.claudeApiKey) redirect("/onboarding");

  const plans = await getUserPlans(session.user.id);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-[#71717a] mt-1">
            {plans.length === 0
              ? "No plans yet — create your first one"
              : `${plans.length} plan${plans.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Link
          href="/plans/new"
          className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black font-medium text-sm px-4 py-2 rounded-md transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          New Plan
        </Link>
      </div>

      {plans.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-14 h-14 bg-[#111] border border-[#222] rounded-xl flex items-center justify-center mb-5">
        <svg
          className="w-6 h-6 text-[#3f3f46]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </div>
      <h2 className="text-base font-medium text-white mb-2">No plans yet</h2>
      <p className="text-sm text-[#71717a] max-w-xs leading-relaxed mb-6">
        Describe a feature requirement in plain English and get a fully
        structured engineering plan with ERD, user flows, and API specs.
      </p>
      <Link
        href="/plans/new"
        className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black font-medium text-sm px-4 py-2 rounded-md transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
        Create your first plan
      </Link>
    </div>
  );
}

interface PlanCardProps {
  plan: {
    id: string;
    title: string;
    model: string;
    createdAt: string | Date;
    updatedAt: string | Date;
  };
}

function PlanCard({ plan }: PlanCardProps) {
  const modelShort = plan.model.replace("claude-", "").replace("-", " ");

  return (
    <Link href={`/plans/${plan.id}`}>
      <div className="group bg-[#111] border border-[#1f1f1f] rounded-xl p-5 hover:border-[#333] hover:bg-[#141414] transition-all cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <div className="w-8 h-8 bg-[#1a1a1a] border border-[#252525] rounded-lg flex items-center justify-center">
            <svg
              className="w-4 h-4 text-[#52525b]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <svg
            className="w-4 h-4 text-[#3f3f46] group-hover:text-[#71717a] transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>

        <h3 className="text-sm font-medium text-white mb-1 leading-snug group-hover:text-green-400 transition-colors line-clamp-2">
          {plan.title}
        </h3>

        <div className="flex items-center gap-3 mt-3">
          <span className="text-[10px] text-[#3f3f46] font-mono bg-[#151515] px-1.5 py-0.5 rounded border border-[#1f1f1f]">
            {modelShort}
          </span>
          <span className="text-[11px] text-[#52525b]">
            {formatRelativeDate(plan.createdAt)}
          </span>
        </div>
      </div>
    </Link>
  );
}
