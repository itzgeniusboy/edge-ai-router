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

function upstreamOfKey(k: string): string {
  const key = (k || "").trim();
  if (/^AIza[0-9A-Za-z\-_]{20,}/.test(key) || /^AQ\.[A-Za-z0-9\-_.]{40,}/.test(key)) return "prov-gemini";
  if (key.startsWith("gsk_")) return "prov-groq";
  if (key.startsWith("sk-or-")) return "prov-openrouter";
  if (key.startsWith("csk-")) return "prov-cerebras";
  return "unknown";
}

// Optional personalization: Bearer/direct/?key= key bhejoge to har model pe
// available:true/false lag jayega (tumhari keys ke hisaab se). Bina key: flag nahi.
function callerUpstreams(req: any): Set<string> | null {
  const found: string[] = [];
  const push = (v: any) => {
    if (typeof v !== "string") return;
    const t = v.trim();
    if (!t || t.toLowerCase() === "bearer" || t.startsWith("er1.")) return;
    found.push(t);
  };
  push(req.headers?.["x-api-key"]);
  push(req.headers?.["x-gemini-key"]);
  const h = typeof req.headers?.authorization === "string" ? req.headers.authorization : "";
  const m = h.match(/^Bearer\s*(.*)$/i);
  push(m ? m[1] : h);
  const q = req.query?.key;
  if (Array.isArray(q)) q.forEach(push);
  else push(q);
  if (found.length === 0) return null;
  return new Set(found.map(upstreamOfKey));
}

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: { message: "Method not allowed", type: "invalid_request_error" } });
  }
  const now = Math.floor(Date.now() / 1000);
  const ups = callerUpstreams(req);
  return res.json({
    object: "list",
    data: UNIVERSAL_MODELS.map((m) => ({
      id: m.id,
      object: "model",
      created: now,
      owned_by: "edge-router",
      upstream: m.upstream,
      gateway: "prov-universal",
      ...(ups ? { available: ups.has(m.upstream) } : {}),
    })),
  });
}
