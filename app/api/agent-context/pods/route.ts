import { NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { AgentContext } from "@/models/AgentContext";
import { sequelize } from "@/lib/sequelize";

export async function GET() {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await sequelize.authenticate();
  const pods = await AgentContext.findAll({
    where: { type: "pod" },
    order: [["createdAt", "ASC"]],
  });
  return NextResponse.json({ pods });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { podName, content } = await req.json() as { podName: string; content: string };
  if (!podName?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "podName and content are required" }, { status: 400 });
  }

  await sequelize.authenticate();
  const existing = await AgentContext.findOne({ where: { type: "pod", podName: podName.trim() } });
  if (existing) {
    return NextResponse.json({ error: "A pod with that name already exists" }, { status: 409 });
  }

  const created = await AgentContext.create({
    type: "pod",
    podName: podName.trim(),
    title: podName.trim(),
    content,
    updatedBy: session.email,
  });
  return NextResponse.json({ pod: created }, { status: 201 });
}
