// ─── Error Classes ───────────────────────────────────────────────────────────

export class AIGenerationError extends Error {
  code: string;
  retryable: boolean;
  provider?: string;

  constructor(message: string, code: string, retryable = false, provider?: string) {
    super(message);
    this.name = "AIGenerationError";
    this.code = code;
    this.retryable = retryable;
    this.provider = provider;
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type ProgressCallback = (step: string) => void;

type StreamEvent = {
  type: "progress" | "result" | "error";
  step?: string;
  data?: unknown;
  error?: string;
  provider?: string;
  model?: string;
};

// ─── Core: requestAIJson (non-streaming, with retry) ─────────────────────────

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

// Task-aware timeout configuration
const TASK_TIMEOUTS: Record<string, number> = {
  website: 180000,       // 3min for website generation
  website_edit: 180000,  // 3min for website edits
  presentation: 150000,  // 2.5min for presentations
};
const DEFAULT_TIMEOUT = 120000; // 2min default

function getTimeoutForTask(task: string): number {
  return TASK_TIMEOUTS[task] || DEFAULT_TIMEOUT;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Exponential backoff with jitter to avoid thundering herd
function getRetryDelay(attempt: number): number {
  const base = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
  const jitter = Math.random() * base * 0.3; // 0-30% jitter
  return base + jitter;
}

function classifyError(status: number, errorMsg: string): AIGenerationError {
  if (status === 429) {
    return new AIGenerationError(
      "Rate limit exceeded. Please wait a moment and try again.",
      "RATE_LIMIT",
      true
    );
  }
  if (status === 401 || status === 403) {
    return new AIGenerationError(
      "API key is invalid or expired. Check your provider keys in Settings.",
      "AUTH_FAILED",
      false
    );
  }
  if (status === 503 || status === 504) {
    return new AIGenerationError(
      "AI provider is temporarily unavailable. Retrying with backup...",
      "PROVIDER_DOWN",
      true
    );
  }
  if (status === 502) {
    return new AIGenerationError(
      errorMsg || "AI generation failed. The model may be overloaded.",
      "GENERATION_FAILED",
      true
    );
  }
  if (status === 400) {
    return new AIGenerationError(
      errorMsg || "Invalid request. Please modify your prompt and try again.",
      "BAD_REQUEST",
      false
    );
  }
  return new AIGenerationError(
    errorMsg || "An unexpected error occurred during generation.",
    "UNKNOWN",
    true
  );
}

export async function requestAIJson<T>(
  task: string,
  input: Record<string, unknown>,
  onProgress?: ProgressCallback
): Promise<T> {
  let lastError: AIGenerationError | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = getRetryDelay(attempt);
      onProgress?.(`Retry ${attempt}/${MAX_RETRIES} in ${Math.round(delay / 1000)}s...`);
      await sleep(delay);
    }

    try {
      onProgress?.(attempt === 0 ? "Connecting to AI provider..." : `Reconnecting (attempt ${attempt + 1})...`);

      const timeout = getTimeoutForTask(task);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, input }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const error = classifyError(response.status, errData?.error || "");

        // Don't retry non-retryable errors
        if (!error.retryable) {
          throw error;
        }

        lastError = error;
        continue;
      }

      onProgress?.("Parsing AI response...");
      const data = await response.json();

      if (!data.result) {
        throw new AIGenerationError(
          "AI returned an empty response. Try simplifying your prompt.",
          "EMPTY_RESPONSE",
          true
        );
      }

      return data.result as T;
    } catch (error) {
      if (error instanceof AIGenerationError) {
        if (!error.retryable) throw error;
        lastError = error;
        continue;
      }

      // AbortController timeout
      if (error instanceof DOMException && error.name === "AbortError") {
        lastError = new AIGenerationError(
          "Request timed out. The AI provider took too long to respond.",
          "TIMEOUT",
          true
        );
        continue;
      }

      // Network failure
      if (error instanceof TypeError && error.message.includes("fetch")) {
        lastError = new AIGenerationError(
          "Network error. Check your internet connection and try again.",
          "NETWORK",
          true
        );
        continue;
      }

      throw new AIGenerationError(
        error instanceof Error ? error.message : "AI generation failed",
        "UNKNOWN",
        false
      );
    }
  }

  throw lastError || new AIGenerationError(
    "All retry attempts failed. Please try again later.",
    "MAX_RETRIES",
    false
  );
}

// ─── Streaming: requestAIStream (SSE-based progress) ─────────────────────────

export async function requestAIStream<T>(
  task: string,
  input: Record<string, unknown>,
  onProgress: ProgressCallback
): Promise<T> {
  const streamTimeout = TASK_TIMEOUTS[task] ? TASK_TIMEOUTS[task] + 30000 : 180000; // Extra 30s for streaming overhead
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), streamTimeout);

  try {
    onProgress("Initializing AI generation pipeline...");

    const response = await fetch("/api/ai/generate/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task, input }),
      signal: controller.signal,
    });

    if (!response.ok) {
      // Fall back to non-streaming
      clearTimeout(timeoutId);
      return requestAIJson<T>(task, input, onProgress);
    }

    if (!response.body) {
      clearTimeout(timeoutId);
      return requestAIJson<T>(task, input, onProgress);
    }

    // Parse SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let result: T | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === "[DONE]") continue;

        try {
          const event: StreamEvent = JSON.parse(jsonStr);

          if (event.type === "progress" && event.step) {
            onProgress(event.step);
          } else if (event.type === "result" && event.data) {
            result = event.data as T;
          } else if (event.type === "error") {
            throw new AIGenerationError(
              event.error || "Stream error from AI provider",
              "STREAM_ERROR",
              false,
              event.provider
            );
          }
        } catch (e) {
          if (e instanceof AIGenerationError) throw e;
          // Skip malformed SSE lines
        }
      }
    }

    clearTimeout(timeoutId);

    if (result) return result;

    // SSE didn't yield a result — fall back to non-streaming
    return requestAIJson<T>(task, input, onProgress);
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof AIGenerationError) throw error;

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new AIGenerationError(
        "Generation timed out. Try a simpler prompt or fewer slides.",
        "TIMEOUT",
        false
      );
    }

    // Network failures — silently fall back to non-streaming
    return requestAIJson<T>(task, input, onProgress);
  }
}
