import { NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { sequelize } from "@/lib/sequelize";
import { Plan } from "@/models/Plan";

export async function GET() {
  const session = await getSession();

  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await sequelize.authenticate();

    const plans = await Plan.findAll({
      where: { userId: session.id },
      order: [["createdAt", "DESC"]],
      attributes: ["id", "title", "model", "createdAt", "updatedAt"],
    });

    return NextResponse.json({ plans: plans.map((p) => p.toJSON()) });
  } catch (error) {
    console.error("Error fetching plans:", error);
    return NextResponse.json({ error: "Failed to fetch plans" }, { status: 500 });
  }
}
