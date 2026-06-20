import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSessionToken, isSameOriginRequest, rateLimit, safeUser, SESSION_COOKIE, sessionCookieOptions } from "@/lib/security";

export const runtime = "nodejs";

type GoogleTokenInfo = {
  aud?: string;
  email?: string;
  email_verified?: string;
  name?: string;
  picture?: string;
  exp?: string;
};

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const retryAfter = rateLimit(request, "auth-google", 10, 15 * 60_000);
    if (retryAfter) return NextResponse.json({ error: "Too many attempts." }, { status: 429, headers: { "Retry-After": String(retryAfter) } });

    const { credential } = await request.json();
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
    if (!clientId || typeof credential !== "string" || credential.length > 5000) {
      return NextResponse.json({ error: "Google authentication is not configured." }, { status: 503 });
    }

    const tokenResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, { cache: "no-store" });
    if (!tokenResponse.ok) return NextResponse.json({ error: "Invalid Google credential." }, { status: 401 });
    const profile = await tokenResponse.json() as GoogleTokenInfo;
    if (
      profile.aud !== clientId || profile.email_verified !== "true" || !profile.email || !profile.name ||
      !profile.exp || Number(profile.exp) * 1000 <= Date.now()
    ) {
      return NextResponse.json({ error: "Invalid Google credential." }, { status: 401 });
    }

    let isNewUser = false;
    let user = await db.getUserByEmail(profile.email);
    if (!user) {
      user = await db.createUser(profile.email, undefined, profile.name, profile.picture);
      isNewUser = true;
    }

    const response = NextResponse.json({ user: safeUser(user), workspaceData: user.workspaceData || null, isNewUser, success: true });
    response.cookies.set(SESSION_COOKIE, createSessionToken(user), sessionCookieOptions);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("Google Auth error:", error);
    return NextResponse.json({ error: "Google authentication failed." }, { status: 500 });
  }
}
