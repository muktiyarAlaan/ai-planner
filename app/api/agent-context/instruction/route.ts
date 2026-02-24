import { NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { AgentContext } from "@/models/AgentContext";
import { sequelize } from "@/lib/sequelize";

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.agentContextEnabled) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { content } = await req.json() as { content: string };
  if (!content?.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  await sequelize.authenticate();
  const existing = await AgentContext.findOne({ where: { type: "instruction" } });
  if (existing) {
    await existing.update({ content, updatedBy: session.email });
    return NextResponse.json({ context: existing });
  }

  const created = await AgentContext.create({
    type: "instruction",
    title: "AI Generation Instructions",
    content,
    updatedBy: session.email,
  });
  return NextResponse.json({ context: created });
}
