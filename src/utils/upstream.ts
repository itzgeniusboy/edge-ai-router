// Shared upstream routing table (frontend mirror of api/v1 + server logic).
// Model naam -> upstream; key prefix -> upstream. Keep in sync with backend maps.
import { detectKeyUpstream } from "./providerKeys";

export const UPSTREAM_META: Record<string, { name: string; short: string }> = {
  "prov-gemini": { name: "Google Gemini", short: "Gemini" },
  "prov-groq": { name: "Groq", short: "Groq" },
  "prov-openrouter": { name: "OpenRouter", short: "OpenRouter" },
  "prov-cerebras": { name: "Cerebras", short: "Cerebras" },
  unknown: { name: "Unknown", short: "?" },
};

export const MODEL_UPSTREAM: Record<string, string> = {
  "gemini-flash-latest": "prov-gemini",
  "gemini-3.6-flash": "prov-gemini",
  "gemini-pro-latest": "prov-gemini",
  "gemini-flash-lite-latest": "prov-gemini",
  "llama-3.3-70b-versatile": "prov-groq",
  "mixtral-8x7b-32768": "prov-groq",
  "gemma2-9b-it": "prov-groq",
  "openai/gpt-4o-mini": "prov-openrouter",
  "meta-llama/llama-3.3-70b-instruct": "prov-openrouter",
  "anthropic/claude-3.5-haiku": "prov-openrouter",
  "llama-3.3-70b": "prov-cerebras",
  "llama3.1-8b": "prov-cerebras",
};

export function upstreamForModel(model: string): string | null {
  if (MODEL_UPSTREAM[model]) return MODEL_UPSTREAM[model];
  if (model.startsWith("openai/") || model.startsWith("anthropic/")) return "prov-openrouter";
  if (model.startsWith("gemini-")) return "prov-gemini";
  return null;
}

export interface ModelKeyStatus {
  model: string;
  upstream: string | null;
  upstreamName: string;
  hasKey: boolean;
}

// Har model ke saath: kaunsa upstream + uski key pool me hai ya nahi.
export function modelsWithKeyStatus(
  models: string[],
  pools: Record<string, string[]>
): ModelKeyStatus[] {
  const allKeys: string[] = [];
  Object.values(pools).forEach((arr) => {
    if (Array.isArray(arr)) allKeys.push(...arr);
  });
  const hasKeyFor = (up: string | null): boolean => {
    if (!up) return allKeys.length > 0;
    return allKeys.some((k) => detectKeyUpstream(k) === up);
  };
  return models.map((model) => {
    const up = upstreamForModel(model);
    return {
      model,
      upstream: up,
      upstreamName: up ? UPSTREAM_META[up]?.short || up : "Auto",
      hasKey: hasKeyFor(up),
    };
  });
}
