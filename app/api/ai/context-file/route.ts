import { NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { sequelize } from "@/lib/sequelize";
import { Plan } from "@/models/Plan";
import { generateContextMarkdown } from "@/lib/context-md";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { planId } = body as { planId: string };
  if (!planId) return NextResponse.json({ error: "planId is required" }, { status: 400 });

  try {
    await sequelize.authenticate();
    const plan = await Plan.findOne({ where: { id: planId, userId: session.id } });
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

    const p = plan.toJSON() as Record<string, unknown>;
    const markdown = await generateContextMarkdown(p);

    await plan.update({ contextMd: markdown });

    return NextResponse.json({ markdown });
  } catch (error) {
    console.error("Error generating context file:", error);
    return NextResponse.json({ error: "Failed to generate context file" }, { status: 500 });
  }
}
