import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { sequelize } from "@/lib/sequelize";
import { User } from "@/models/User";
import { encrypt } from "@/lib/crypto";

interface LinearTeam { id: string; name: string; key: string; }

async function validateLinearToken(token: string): Promise<{ viewerName: string; teams: LinearTeam[] }> {
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: token },
    body: JSON.stringify({ query: "{ viewer { id name } teams { nodes { id name key } } }" }),
  });
  if (!res.ok) throw new Error("Invalid Linear token — could not reach Linear API");
  const data = await res.json();
  if (data.errors) throw new Error("Invalid Linear API key. Please check and try again.");
  return {
    viewerName: data.data?.viewer?.name ?? "Linear",
    teams: data.data?.teams?.nodes ?? [],
  };
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { token } = body;
  if (!token || typeof token !== "string" || token.trim().length === 0) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  const trimmedToken = token.trim();

  // Validate by making a real API call
  try {
    const { viewerName, teams } = await validateLinearToken(trimmedToken);

    await sequelize.authenticate();
    await User.update(
      { linearAccessToken: encrypt(trimmedToken) },
      { where: { id: session.id } }
    );

    return NextResponse.json({ success: true, workspaceName: viewerName, teams });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to validate token" },
      { status: 400 }
    );
  }
}

export async function DELETE() {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await sequelize.authenticate();
    await User.update(
      { linearAccessToken: null },
      { where: { id: session.id } }
    );
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to disconnect Linear" }, { status: 500 });
  }
}
