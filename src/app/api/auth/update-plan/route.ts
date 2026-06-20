import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, safeUser } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const { plan } = await request.json();
    if (!["free", "pro", "enterprise"].includes(plan)) return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
    db.updateUserPlan(session.userId, plan);
    const user = db.getUserById(session.userId);
    return NextResponse.json({ success: true, user: user ? safeUser(user) : null });
  } catch (error) {
    console.error("Update plan error:", error);
    return NextResponse.json({ error: "Failed to update plan." }, { status: 500 });
  }
}
