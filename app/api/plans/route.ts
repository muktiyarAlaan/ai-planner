import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sequelize } from "@/lib/sequelize";
import { Plan } from "@/models/Plan";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await sequelize.authenticate();

    const plans = await Plan.findAll({
      where: { userId: session.user.id },
      order: [["createdAt", "DESC"]],
      attributes: ["id", "title", "model", "createdAt", "updatedAt"],
    });

    return NextResponse.json({ plans: plans.map((p) => p.toJSON()) });
  } catch (error) {
    console.error("Error fetching plans:", error);
    return NextResponse.json({ error: "Failed to fetch plans" }, { status: 500 });
  }
}
