import { NextResponse } from "next/server";
import { db, hashPassword, verifyPassword } from "@/lib/db";
import { createSessionToken, isSameOriginRequest, rateLimit, safeUser, SESSION_COOKIE, sessionCookieOptions } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const retryAfter = rateLimit(request, "auth-login", 8, 15 * 60_000);
    if (retryAfter) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429, headers: { "Retry-After": String(retryAfter) } });

    const { email, password } = await request.json();
    if (typeof email !== "string" || typeof password !== "string" || email.length > 254 || password.length > 256) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const user = await db.getUserByEmail(email);
    if (!user?.passwordHash) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });

    const verification = verifyPassword(password, user.passwordHash);
    if (!verification.valid) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    if (verification.needsUpgrade) await db.updatePasswordHash(user.id, hashPassword(password));

    const response = NextResponse.json({ user: safeUser(user), workspaceData: user.workspaceData || null, success: true });
    response.cookies.set(SESSION_COOKIE, createSessionToken(user), sessionCookieOptions);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}
