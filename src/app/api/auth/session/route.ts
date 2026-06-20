import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, safeUser, SESSION_COOKIE, sessionCookieOptions } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = getSession(request);
  let user = session ? await db.getUserById(session.userId) : null;
  if (session && !user) {
    try {
      user = await db.recreateUser({
        id: session.userId,
        email: session.email,
        fullName: session.fullName,
        role: session.role,
        plan: session.plan,
        planExpiresAt: session.planExpiresAt,
        hasClaimedPromo: session.hasClaimedPromo,
        planDuration: session.planDuration,
      });
      console.log(`Recreated session user ${session.email} in fresh Vercel /tmp container.`);
    } catch (e) {
      console.error("Failed to recreate session user:", e);
    }
  }
  if (!user) return NextResponse.json({ authenticated: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ authenticated: true, user: safeUser(user) }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
