import { NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { sequelize } from "@/lib/sequelize";
import { Plan } from "@/models/Plan";

interface RouteContext {
  params: { id: string };
}

// ── PATCH /api/plans/[id] — update any plan fields ──────────────────────────
export async function PATCH(req: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;
  const body = await req.json();

  // Whitelist of updatable fields
  const allowed = [
    "title",
    "requirements",
    "apiEndpoints",
    "userFlows",
    "entities",
    "contextMd",
    "linearTickets",
    "securityReview",
  ] as const;

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  try {
    await sequelize.authenticate();
    const [count] = await Plan.update(updates, {
      where: { id, userId: session.id },
    });

    if (count === 0) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating plan:", error);
    return NextResponse.json({ error: "Failed to update plan" }, { status: 500 });
  }
}
