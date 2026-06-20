import { NextResponse } from "next/server";
import { generateAIText, type AIMessage } from "@/lib/ai/server";
import { getSession, isSameOriginRequest, rateLimit } from "@/lib/security";

export const runtime = "nodejs";

type ChatRequestBody = {
  model?: string;
  messages?: AIMessage[];
  filesContext?: string;
};

function systemPrompt(filesContext?: string) {
  return [
    "You are NeuroFlow AI inside a workspace SaaS.",
    "Be concise, useful, and practical. Use Markdown where it helps.",
    filesContext ? `Attached workspace context:\n${filesContext.slice(0, 6000)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const retryAfter = rateLimit(request, `ai-chat-${session.userId}`, 30, 60_000);
  if (retryAfter) return NextResponse.json({ error: "AI rate limit exceeded." }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
  const body = (await request.json()) as ChatRequestBody;

  // Try Python backend first
  try {
    const pythonResponse = await fetch("http://127.0.0.1:8000/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (pythonResponse.ok) {
      const data = await pythonResponse.json();
      return NextResponse.json(data);
    } else {
      const errData = await pythonResponse.json().catch(() => ({}));
      if (errData.error) {
        return NextResponse.json({ error: errData.error }, { status: pythonResponse.status });
      }
    }
  } catch (error) {
    console.log("Python backend offline or failed, falling back to local: ", error);
  }

  // Local fallback
  try {
    const messages = (body.messages || []).slice(-12);
    const result = await generateAIText(
      [{ role: "system", content: systemPrompt(body.filesContext) }, ...messages],
      body.model,
    );

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI request failed";
    const status = message === "No private AI provider key configured" ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
