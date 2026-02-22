import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { sequelize } from "@/lib/sequelize";
import { User } from "@/models/User";

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { name } = body;
  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  try {
    await sequelize.authenticate();
    await User.update(
      { name: name.trim() },
      { where: { id: session.id } }
    );
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
