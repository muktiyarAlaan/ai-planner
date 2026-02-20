import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { validateAnthropicKey } from "@/lib/anthropic";
import { sequelize } from "@/lib/sequelize";
import { User } from "@/models/User";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { apiKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { apiKey } = body;

  if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length === 0) {
    return NextResponse.json(
      { error: "API key is required" },
      { status: 400 }
    );
  }

  const trimmedKey = apiKey.trim();

  // Validate the key format first
  if (!trimmedKey.startsWith("sk-ant-")) {
    return NextResponse.json(
      { error: "Invalid API key format. Anthropic keys start with sk-ant-" },
      { status: 400 }
    );
  }

  // Validate by making a real API call
  try {
    await validateAnthropicKey(trimmedKey);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to validate API key" },
      { status: 400 }
    );
  }

  // Encrypt and save
  try {
    await sequelize.authenticate();
    const encryptedKey = encrypt(trimmedKey);

    await User.update(
      { claudeApiKey: encryptedKey },
      { where: { id: session.user.id } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving API key:", error);
    return NextResponse.json(
      { error: "Failed to save API key. Please try again." },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await sequelize.authenticate();
    await User.update(
      { claudeApiKey: null },
      { where: { id: session.user.id } }
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing API key:", error);
    return NextResponse.json({ error: "Failed to remove API key" }, { status: 500 });
  }
}
