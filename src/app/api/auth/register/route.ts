import { NextResponse } from "next/server";
import { db, hashPassword } from "@/lib/db";
import { createSessionToken, isSameOriginRequest, rateLimit, safeUser, SESSION_COOKIE, sessionCookieOptions } from "@/lib/security";

export const runtime = "nodejs";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const retryAfter = rateLimit(request, "auth-register", 5, 60 * 60_000);
    if (retryAfter) return NextResponse.json({ error: "Too many registrations. Try again later." }, { status: 429, headers: { "Retry-After": String(retryAfter) } });

    const { email, password, fullName } = await request.json();
    if (
      typeof email !== "string" || !EMAIL_PATTERN.test(email) || email.length > 254 ||
      typeof password !== "string" || password.length < 12 || password.length > 128 ||
      typeof fullName !== "string" || fullName.trim().length < 2 || fullName.trim().length > 80
    ) {
      return NextResponse.json({ error: "Use a valid email, name, and a password of at least 12 characters." }, { status: 400 });
    }
    if (await db.getUserByEmail(email)) return NextResponse.json({ error: "Unable to create account with these details." }, { status: 409 });

    const user = await db.createUser(email, hashPassword(password), fullName.trim());
    const response = NextResponse.json({ user: safeUser(user), success: true }, { status: 201 });
    response.cookies.set(SESSION_COOKIE, createSessionToken(user), sessionCookieOptions);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "Registration failed." }, { status: 500 });
  }
}
