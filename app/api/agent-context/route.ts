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
  const rows = await AgentContext.findAll({ order: [["createdAt", "ASC"]] });
  return NextResponse.json({ contexts: rows });
}
