import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { sequelize } from "@/lib/sequelize";
import { User } from "@/models/User";

interface RepoEntry {
  fullName: string;
  owner: string;
  repo: string;
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { repos?: RepoEntry[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { repos } = body;
  if (!Array.isArray(repos)) {
    return NextResponse.json({ error: "repos must be an array" }, { status: 400 });
  }

  const validated = repos.filter(
    (r) => r && typeof r.fullName === "string" && typeof r.owner === "string" && typeof r.repo === "string"
  );

  try {
    await sequelize.authenticate();
    await User.update(
      { githubRepos: validated },
      { where: { id: session.id } }
    );
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to save repos" }, { status: 500 });
  }
}
