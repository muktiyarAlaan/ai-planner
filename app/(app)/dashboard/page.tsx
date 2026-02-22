import { redirect } from "next/navigation";
import { getSession } from "@/lib/get-session";
import { sequelize } from "@/lib/sequelize";
import { Plan } from "@/models/Plan";
import { DashboardPlans } from "@/components/dashboard-plans";

async function getUserPlans(userId: string) {
  try {
    await sequelize.authenticate();
    const plans = await Plan.findAll({
      where: { userId },
      order: [["createdAt", "DESC"]],
      attributes: ["id", "title", "model", "rawRequirement", "requirements", "entities", "apiEndpoints", "createdAt", "updatedAt"],
    });
    return plans.map((p) => p.toJSON());
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) redirect("/login");

  const plans = await getUserPlans(session.id);

  return <DashboardPlans plans={plans} userName={session.name} />;
}
