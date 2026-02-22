import { NextResponse } from "next/server";
import { sequelize } from "@/lib/sequelize";
import { Plan } from "@/models/Plan";

interface RouteContext {
  params: { token: string };
}

// ── GET /api/shared/[token] — public, no auth required ───────────────────────
export async function GET(_req: Request, { params }: RouteContext) {
  const { token } = params;

  try {
    await sequelize.authenticate();
    const plan = await Plan.findOne({
      where: { shareToken: token, isShared: true },
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan not found or no longer shared" }, { status: 404 });
    }

    return NextResponse.json({ plan: plan.toJSON() });
  } catch (error) {
    console.error("Error fetching shared plan:", error);
    return NextResponse.json({ error: "Failed to fetch plan" }, { status: 500 });
  }
}
