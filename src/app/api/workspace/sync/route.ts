import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, isSameOriginRequest, rateLimit } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const retryAfter = rateLimit(request, `workspace-sync-${session.userId}`, 120, 60_000);
    if (retryAfter) return NextResponse.json({ error: "Sync rate limit exceeded." }, { status: 429, headers: { "Retry-After": String(retryAfter) } });

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 2_000_000) return NextResponse.json({ error: "Workspace payload is too large." }, { status: 413 });
    const { workspaces, folders, files, activeWorkspaceId } = await request.json();
    if (!Array.isArray(workspaces) || !Array.isArray(folders) || !Array.isArray(files) || typeof activeWorkspaceId !== "string") {
      return NextResponse.json({ error: "Invalid workspace payload." }, { status: 400 });
    }

    let user = await db.getUserById(session.userId);
    if (!user) {
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
      console.log(`Recreated session user ${session.email} in workspace sync route.`);
    }

    await db.updateWorkspaceData(session.userId, { workspaces, folders, files, activeWorkspaceId });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Workspace sync error:", error);
    return NextResponse.json({ error: "Workspace sync failed." }, { status: 500 });
  }
}
