import { NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { AgentContext } from "@/models/AgentContext";
import { sequelize } from "@/lib/sequelize";

export async function PUT(
  req: Request,
  { params }: { params: { podName: string } }
) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.agentContextEnabled) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const podName = decodeURIComponent(params.podName);
  const { content } = await req.json() as { content: string };
  if (!content?.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  await sequelize.authenticate();
  const pod = await AgentContext.findOne({ where: { type: "pod", podName } });
  if (!pod) {
    return NextResponse.json({ error: "Pod not found" }, { status: 404 });
  }

  await pod.update({ content, updatedBy: session.email });
  return NextResponse.json({ pod });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { podName: string } }
) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.agentContextEnabled) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const podName = decodeURIComponent(params.podName);

  await sequelize.authenticate();
  const pod = await AgentContext.findOne({ where: { type: "pod", podName } });
  if (!pod) {
    return NextResponse.json({ error: "Pod not found" }, { status: 404 });
  }

  await pod.destroy();
  return NextResponse.json({ success: true });
}
