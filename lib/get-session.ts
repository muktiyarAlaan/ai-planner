import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { User } from "@/models/User";
import { sequelize } from "@/lib/sequelize";
import { decrypt } from "@/lib/crypto";

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  claudeApiKey: string | null;
  hasLinearToken: boolean;
  /** Decrypted token — only for server-side API calls, never sent to client */
  linearAccessToken: string | null;
  hasGithubToken: boolean;
  githubRepos: { fullName: string; owner: string; repo: string }[] | null;
}

const secret = new TextEncoder().encode(process.env.SESSION_SECRET!);

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = cookies();
  const token = cookieStore.get("session")?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    const userId = payload.userId as string;
    if (!userId) return null;

    await sequelize.authenticate();
    const user = await User.findOne({
      where: { id: userId },
      attributes: ["id", "email", "name", "image", "claudeApiKey", "linearAccessToken", "githubAccessToken", "githubRepos"],
    });

    if (!user) return null;

    const encryptedToken = user.linearAccessToken;
    let linearAccessToken: string | null = null;
    if (encryptedToken) {
      try {
        linearAccessToken = decrypt(encryptedToken);
      } catch {
        linearAccessToken = null;
      }
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      claudeApiKey: user.claudeApiKey,
      hasLinearToken: !!encryptedToken,
      linearAccessToken,
      hasGithubToken: !!user.githubAccessToken,
      githubRepos: user.githubRepos ?? null,
    };
  } catch {
    return null;
  }
}
