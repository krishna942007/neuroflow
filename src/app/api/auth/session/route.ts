import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, safeUser, SESSION_COOKIE, sessionCookieOptions } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = getSession(request);
  const user = session ? db.getUserById(session.userId) : null;
  if (!user) return NextResponse.json({ authenticated: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ authenticated: true, user: safeUser(user) }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
