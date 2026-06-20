import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, safeUser, createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const { plan } = await request.json();
    if (!["free", "pro", "enterprise"].includes(plan)) return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
    await db.updateUserPlan(session.userId, plan);
    const user = await db.getUserById(session.userId);
    if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
    const response = NextResponse.json({ success: true, user: safeUser(user) });
    response.cookies.set(SESSION_COOKIE, createSessionToken(user), sessionCookieOptions);
    return response;
  } catch (error) {
    console.error("Update plan error:", error);
    return NextResponse.json({ error: "Failed to update plan." }, { status: 500 });
  }
}
