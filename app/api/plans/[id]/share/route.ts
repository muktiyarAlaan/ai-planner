import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSession } from "@/lib/get-session";
import { sequelize } from "@/lib/sequelize";
import { Plan } from "@/models/Plan";

interface RouteContext {
  params: { id: string };
}

// ── POST /api/plans/[id]/share — enable sharing, generate token ──────────────
export async function POST(_req: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  try {
    await sequelize.authenticate();
    const plan = await Plan.findOne({ where: { id, userId: session.id } });
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Use existing token or generate new 12-char hex token
    const shareToken = plan.shareToken ?? randomBytes(6).toString("hex");

    await plan.update({ shareToken, isShared: true });

    const host =
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    return NextResponse.json({ shareUrl: `${host}/shared/${shareToken}` });
  } catch (error) {
    console.error("Error creating share link:", error);
    return NextResponse.json({ error: "Failed to create share link" }, { status: 500 });
  }
}

// ── DELETE /api/plans/[id]/share — disable sharing ───────────────────────────
export async function DELETE(_req: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  try {
    await sequelize.authenticate();
    const [count] = await Plan.update(
      { isShared: false, shareToken: null },
      { where: { id, userId: session.id } }
    );

    if (count === 0) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disabling share link:", error);
    return NextResponse.json({ error: "Failed to disable share link" }, { status: 500 });
  }
}
