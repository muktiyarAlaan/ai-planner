import { sequelize } from "@/lib/sequelize";
import { Plan } from "@/models/Plan";
import { PlanData } from "@/types/plan";
import { SharedPlanView } from "@/components/plan/shared-plan-view";
import Link from "next/link";

async function getSharedPlan(token: string): Promise<PlanData | null> {
  try {
    await sequelize.authenticate();
    const plan = await Plan.findOne({ where: { shareToken: token, isShared: true } });
    if (!plan) return null;
    return plan.toJSON() as unknown as PlanData;
  } catch {
    return null;
  }
}

interface PageProps {
  params: { token: string };
}

export default async function SharedPlanPage({ params }: PageProps) {
  const plan = await getSharedPlan(params.token);

  if (!plan) {
    return (
      <div className="min-h-screen bg-[#f5f6fa] flex flex-col items-center justify-center text-center px-6">
        <div className="w-16 h-16 bg-white border border-[#e2e8f0] rounded-2xl flex items-center justify-center mb-5 shadow-sm">
          <svg className="w-8 h-8 text-[#94a3b8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-[#0f172a] mb-2">Plan no longer available</h1>
        <p className="text-sm text-[#64748b] max-w-xs mb-6 leading-relaxed">
          This shared plan link has been disabled or no longer exists.
        </p>
        <Link
          href="/login"
          className="flex items-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-medium text-sm px-5 py-2.5 rounded-lg transition-colors shadow-sm"
        >
          Create your own plan →
        </Link>
      </div>
    );
  }

  return <SharedPlanView plan={plan} />;
}
