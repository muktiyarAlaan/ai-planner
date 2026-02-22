import { notFound } from "next/navigation";
import { getSession } from "@/lib/get-session";
import { sequelize } from "@/lib/sequelize";
import { Plan } from "@/models/Plan";
import { PlanView } from "@/components/plan/plan-view";
import { PlanData } from "@/types/plan";

async function getPlan(id: string, userId: string): Promise<PlanData | null> {
  try {
    await sequelize.authenticate();
    const plan = await Plan.findOne({ where: { id, userId } });
    if (!plan) return null;
    return plan.toJSON() as unknown as PlanData;
  } catch {
    return null;
  }
}

interface PageProps {
  params: { id: string };
}

export default async function PlanPage({ params }: PageProps) {
  const session = await getSession();
  if (!session?.id) return notFound();

  const plan = await getPlan(params.id, session.id);
  if (!plan) return notFound();

  return <PlanView plan={plan} user={session} />;
}
