export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type Provider = "gemini" | "groq" | "openrouter" | "openai";

type ProviderConfig = {
  provider: Provider;
  apiKey: string;
  model: string;
};

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function configured(name: string) {
  const val = process.env[name]?.trim() || "";
  return val;
}

function preferredProvider(model?: string): Provider | null {
  if (!model) return null;
  const m = model.toLowerCase();
  if (m.startsWith("gemini")) return "gemini";
  if (m.startsWith("groq") || m.includes("llama") || m.includes("mixtral")) return "groq";
  if (m.startsWith("openai") || m.startsWith("gpt-") || m.startsWith("o1-") || m.startsWith("o3-")) return "openai";
  if (m.startsWith("openrouter") || m.includes("/")) return "openrouter";
  return null;
}

function providerConfig(provider: Provider, requestedModel?: string): ProviderConfig | null {
  const m = requestedModel?.toLowerCase() || "";
  
  if (provider === "gemini") {
    const apiKey = configured("GEMINI_API_KEY");
    if (!apiKey) return null;
    let model = configured("GEMINI_MODEL") || "gemini-2.5-flash";
    if (requestedModel && requestedModel !== "gemini" && requestedModel.startsWith("gemini")) {
      model = requestedModel;
    }
    return { provider, apiKey, model };
  }

  if (provider === "groq") {
    const apiKey = configured("GROQ_API_KEY");
    if (!apiKey) return null;
    let model = configured("GROQ_MODEL") || "llama-3.3-70b-versatile";
    if (requestedModel && requestedModel !== "groq" && (requestedModel.startsWith("groq") || m.includes("llama") || m.includes("mixtral"))) {
      model = requestedModel;
    }
    return { provider, apiKey, model };
  }

  if (provider === "openrouter") {
    const apiKey = configured("OPENROUTER_API_KEY");
    if (!apiKey) return null;
    let model = configured("OPENROUTER_MODEL") || "openrouter/free";
    if (requestedModel && requestedModel !== "openrouter" && (requestedModel.startsWith("openrouter") || requestedModel.includes("/"))) {
      model = requestedModel;
    }
    return { provider, apiKey, model };
  }

  if (provider === "openai") {
    const apiKey = configured("OPENAI_API_KEY");
    if (!apiKey) return null;
    let model = configured("OPENAI_MODEL") || "gpt-4o-mini";
    if (requestedModel && requestedModel !== "openai" && (requestedModel.startsWith("openai") || requestedModel.startsWith("gpt-") || requestedModel.startsWith("o1-") || requestedModel.startsWith("o3-"))) {
      model = requestedModel;
    }
    return { provider, apiKey, model };
  }

  return null;
}

function availableProviders(requestedModel?: string) {
  const preferred = preferredProvider(requestedModel);
  const ordered: Provider[] = preferred
    ? [preferred, "groq", "gemini", "openrouter", "openai"]
    : ["groq", "gemini", "openrouter", "openai"];

  return [...new Set(ordered)]
    .map((provider) => providerConfig(provider, requestedModel))
    .filter((provider): provider is ProviderConfig => Boolean(provider));
}

export function getConfiguredProviders() {
  return (["groq", "gemini", "openrouter", "openai"] as Provider[])
    .filter((provider) => Boolean(providerConfig(provider)));
}

async function providerFetch(url: string, init: RequestInit, timeoutMs = 45000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function callGemini(config: ProviderConfig, messages: AIMessage[], maxTokens = 4096) {
  const prompt = messages.map((message) => `${message.role.toUpperCase()}:\n${message.content}`).join("\n\n");
  const timeoutMs = maxTokens > 8192 ? 90000 : 45000;
  const response = await providerFetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.65, maxOutputTokens: maxTokens },
      }),
    },
    timeoutMs,
  );

  if (!response.ok) {
    throw new Error(`Gemini request failed with ${response.status}`);
  }

  const data = await response.json();
  const content = data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("");
  if (!content) throw new Error("Gemini returned an empty response");
  return content as string;
}

async function callOpenAICompatible(config: ProviderConfig, messages: AIMessage[], maxTokens = 4096) {
  const endpoint = config.provider === "groq" ? GROQ_URL : config.provider === "openrouter" ? OPENROUTER_URL : OPENAI_URL;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
  };

  if (config.provider === "openrouter") {
    headers["HTTP-Referer"] = configured("NEXT_PUBLIC_APP_URL") || "http://localhost:3000";
    headers["X-Title"] = "NeuroFlow AI";
  }

  // Check if the system message requests JSON output
  const systemMsg = messages.find(m => m.role === "system")?.content || "";
  const wantsJson = systemMsg.toLowerCase().includes("json");

  const payload: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: 0.65,
    max_tokens: maxTokens,
  };

  // Enforce structured JSON output for OpenAI models
  if (config.provider === "openai" && wantsJson) {
    payload.response_format = { type: "json_object" };
  }

  const timeoutMs = maxTokens > 8192 ? 90000 : 45000;
  const response = await providerFetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  }, timeoutMs);

  if (!response.ok) {
    throw new Error(`${config.provider} request failed with ${response.status}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error(`${config.provider} returned an empty response`);
  }
  return content;
}

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const PROVIDER_RETRY_DELAY_MS = 2000;

async function callProviderWithRetry(
  provider: ProviderConfig,
  messages: AIMessage[],
  maxTokens: number,
  maxRetries = 1
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return provider.provider === "gemini"
        ? await callGemini(provider, messages, maxTokens)
        : await callOpenAICompatible(provider, messages, maxTokens);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if retryable (status code in error message or network error)
      const statusMatch = lastError.message.match(/failed with (\d+)/);
      const status = statusMatch ? parseInt(statusMatch[1]) : 0;
      const isRetryable = RETRYABLE_STATUSES.has(status) ||
        lastError.message.includes("abort") ||
        lastError.message.includes("network");

      if (!isRetryable || attempt >= maxRetries) break;

      // Exponential backoff delay before retry
      await new Promise((r) => setTimeout(r, PROVIDER_RETRY_DELAY_MS * (attempt + 1)));
    }
  }

  throw lastError || new Error(`${provider.provider} failed`);
}

export async function generateAIText(messages: AIMessage[], requestedModel?: string, maxTokens = 4096) {
  const providers = availableProviders(requestedModel);
  if (providers.length === 0) {
    throw new Error("No AI provider key configured. Add OPENAI_API_KEY, GEMINI_API_KEY, or GROQ_API_KEY to your environment.");
  }

  const failures: string[] = [];
  for (const provider of providers) {
    try {
      const content = await callProviderWithRetry(provider, messages, maxTokens);
      return { content, provider: provider.provider, model: provider.model };
    } catch (error) {
      const msg = error instanceof Error ? error.message : `${provider.provider} request failed`;
      failures.push(`[${provider.provider}/${provider.model}] ${msg}`);
    }
  }

  throw new Error(`All AI providers failed:\n${failures.join("\n")}`);
}
