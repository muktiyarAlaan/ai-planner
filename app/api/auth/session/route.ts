import { NextRequest, NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { User } from "@/models/User";
import { sequelize } from "@/lib/sequelize";

const FIREBASE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!;
const SESSION_SECRET = new TextEncoder().encode(process.env.SESSION_SECRET!);

export async function POST(request: NextRequest) {
  let body: { idToken?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { idToken } = body;
  if (!idToken) {
    return NextResponse.json({ error: "ID token required" }, { status: 400 });
  }

  try {
    // Verify Firebase ID token using Firebase's public JWKS (no Admin SDK needed)
    const JWKS = createRemoteJWKSet(new URL(FIREBASE_JWKS_URL));
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
    });

    const email = payload.email as string;
    const name = (payload.name as string) ?? null;
    const picture = (payload.picture as string) ?? null;

    if (!email) {
      return NextResponse.json({ error: "Email not found in token" }, { status: 400 });
    }

    // Upsert user in DB (same logic as previous NextAuth signIn callback)
    await sequelize.authenticate();
    const [dbUser] = await User.findOrCreate({
      where: { email },
      defaults: { email, name, image: picture },
    });

    if (dbUser.name !== name || dbUser.image !== picture) {
      await dbUser.update({ name, image: picture });
    }

    // Create our own signed session JWT
    const sessionToken = await new SignJWT({ userId: dbUser.id })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(SESSION_SECRET);

    const response = NextResponse.json({
      success: true,
      hasLinearToken: !!dbUser.linearAccessToken,
    });
    response.cookies.set("session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Session creation error:", message);
    return NextResponse.json(
      { error: "Authentication failed", detail: message },
      { status: 401 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete("session");
  return response;
}
