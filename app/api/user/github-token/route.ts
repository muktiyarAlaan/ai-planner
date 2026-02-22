import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { sequelize } from "@/lib/sequelize";
import { User } from "@/models/User";
import { encrypt } from "@/lib/crypto";

interface GithubRepo {
  fullName: string;
  owner: string;
  repo: string;
  private: boolean;
  updatedAt: string;
}

async function validateGithubToken(token: string): Promise<GithubRepo[]> {
  const res = await fetch(
    "https://api.github.com/user/repos?per_page=100&type=all&sort=updated",
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  );

  if (res.status === 401) throw new Error("Invalid GitHub token. Please check and try again.");
  if (!res.ok) throw new Error("Could not reach GitHub API. Please try again.");

  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("Unexpected response from GitHub API.");

  return data.map((r: { full_name: string; owner: { login: string }; name: string; private: boolean; updated_at: string }) => ({
    fullName: r.full_name,
    owner: r.owner.login,
    repo: r.name,
    private: r.private,
    updatedAt: r.updated_at,
  }));
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

  try {
    const repos = await validateGithubToken(trimmedToken);

    await sequelize.authenticate();
    await User.update(
      { githubAccessToken: encrypt(trimmedToken) },
      { where: { id: session.id } }
    );

    return NextResponse.json({ success: true, repos });
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
      { githubAccessToken: null, githubRepos: null },
      { where: { id: session.id } }
    );
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to disconnect GitHub" }, { status: 500 });
  }
}
