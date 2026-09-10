// OpenAI-compatible model list — FULLY SELF-CONTAINED (no cross-file imports).
// GET /api/v1/models -> { object: "list", data: [{ id, object: "model", ... }] }.
// External clients (Nexus / OpenCode / Cursor / LibreChat) isi se switch-model list bharte hai.
const UNIVERSAL_MODELS: { id: string; upstream: string }[] = [
  { id: "gemini-flash-latest", upstream: "prov-gemini" },
  { id: "gemini-3.6-flash", upstream: "prov-gemini" },
  { id: "gemini-pro-latest", upstream: "prov-gemini" },
  { id: "gemini-flash-lite-latest", upstream: "prov-gemini" },
  { id: "llama-3.3-70b-versatile", upstream: "prov-groq" },
  { id: "mixtral-8x7b-32768", upstream: "prov-groq" },
  { id: "gemma2-9b-it", upstream: "prov-groq" },
  { id: "openai/gpt-4o-mini", upstream: "prov-openrouter" },
  { id: "meta-llama/llama-3.3-70b-instruct", upstream: "prov-openrouter" },
  { id: "anthropic/claude-3.5-haiku", upstream: "prov-openrouter" },
  { id: "llama-3.3-70b", upstream: "prov-cerebras" },
  { id: "llama3.1-8b", upstream: "prov-cerebras" },
];

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: { message: "Method not allowed", type: "invalid_request_error" } });
  }
  const now = Math.floor(Date.now() / 1000);
  return res.json({
    object: "list",
    data: UNIVERSAL_MODELS.map((m) => ({
      id: m.id,
      object: "model",
      created: now,
      owned_by: "edge-router",
      upstream: m.upstream,
      gateway: "prov-universal",
    })),
  });
}
