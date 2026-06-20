import crypto from "crypto";

export const SESSION_COOKIE = "neuroflow_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type SessionPayload = {
  userId: string;
  email: string;
  fullName: string;
  role: "admin" | "user";
  plan: "free" | "pro" | "enterprise";
  planExpiresAt?: string;
  hasClaimedPromo?: boolean;
  planDuration?: number;
  expiresAt: number;
};

function getSessionSecret(): string {
  const secret = (
    process.env.SESSION_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.GEMINI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.GROQ_API_KEY
  )?.trim();
  if (secret) return crypto.createHash("sha256").update(`neuroflow-session:${secret}`).digest("hex");
  if (process.env.NODE_ENV !== "production") return "neuroflow-local-development-only-secret";
  throw new Error("SESSION_SECRET must be configured in production.");
}

function encode(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function sign(value: string): string {
  return crypto.createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

export function createSessionToken(user: {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "user";
  plan: "free" | "pro" | "enterprise";
  planExpiresAt?: string;
  hasClaimedPromo?: boolean;
  planDuration?: number;
}): string {
  const payload = encode(JSON.stringify({
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    plan: user.plan,
    planExpiresAt: user.planExpiresAt,
    hasClaimedPromo: user.hasClaimedPromo,
    planDuration: user.planDuration,
    expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
  } satisfies SessionPayload));
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token?: string): SessionPayload | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionPayload;
    if (!parsed.userId || !Number.isFinite(parsed.expiresAt) || parsed.expiresAt <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};

function readCookie(request: Request, name: string): string | undefined {
  const cookies = request.headers.get("cookie") || "";
  for (const part of cookies.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
}

export function getSession(request: Request): SessionPayload | null {
  return verifySessionToken(readCookie(request, SESSION_COOKIE));
}

export function isSameOriginRequest(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const requestUrl = new URL(request.url);
    const allowedOrigin = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
    return origin === requestUrl.origin || (!!allowedOrigin && origin === new URL(allowedOrigin).origin);
  } catch {
    return false;
  }
}

type RateEntry = { count: number; resetAt: number };
const rateLimitStore = new Map<string, RateEntry>();

export function rateLimit(request: Request, bucket: string, limit: number, windowMs: number): number | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientId = forwarded || request.headers.get("x-real-ip") || "local";
  const key = `${bucket}:${clientId}`;
  const now = Date.now();
  const current = rateLimitStore.get(key);
  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  current.count += 1;
  if (current.count <= limit) return null;
  return Math.max(1, Math.ceil((current.resetAt - now) / 1000));
}

export function safeUser<T extends { passwordHash?: string }>(user: T): Omit<T, "passwordHash"> {
  const { passwordHash: _passwordHash, ...sanitized } = user;
  return sanitized;
}
