// In-app Tester inference — FULLY SELF-CONTAINED (no cross-file imports).
// Body: { prompt, model?, apiKeys?/clientApiKey? } (+ legacy providerId/baseUrl tolerated).
// Model naam se upstream auto-route; 401 when none configured (no fake success).
const UPSTREAMS: Record<string, { name: string; baseUrl: string; defaultModel: string }> = {
  "prov-gemini": { name: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", defaultModel: "gemini-flash-latest" },
  "prov-groq": { name: "Groq", baseUrl: "https://api.groq.com/openai/v1", defaultModel: "llama-3.3-70b-versatile" },
  "prov-openrouter": { name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", defaultModel: "google/gemma-4-31b-it:free" },
  "prov-cerebras": { name: "Cerebras", baseUrl: "https://api.cerebras.ai/v1", defaultModel: "llama-3.3-70b" },
};

const UPSTREAM_PRIORITY = ["prov-gemini", "prov-groq", "prov-openrouter", "prov-cerebras"];

const MODEL_UPSTREAM: Record<string, string> = {
  "gemini-flash-latest": "prov-gemini",
  "gemini-3.6-flash": "prov-gemini",
  "gemini-pro-latest": "prov-gemini",
  "gemini-flash-lite-latest": "prov-gemini",
  "llama-3.3-70b-versatile": "prov-groq",
  "mixtral-8x7b-32768": "prov-groq",
  "gemma2-9b-it": "prov-groq",
  "google/gemma-4-31b-it:free": "prov-openrouter",
  "nex-agi/nex-n2.5-mini:free": "prov-openrouter",
  "liquid/lfm-2.5-2.6b:free": "prov-openrouter",
  "llama-3.3-70b": "prov-cerebras",
  "llama3.1-8b": "prov-cerebras",
};

const LEGACY_GEMINI_ALIAS: Record<string, string> = {
  "gemini-2.5-flash": "gemini-flash-latest",
  "gemini-2.0-flash": "gemini-flash-latest",
  "gemini-1.5-flash": "gemini-flash-latest",
  "gemini-1.5-pro": "gemini-pro-latest",
  "gemini-2.0-flash-lite": "gemini-flash-lite-latest",
};

function detectKeyUpstream(key: string): string {
  const k = (key || "").trim();
  if (/^AIza[0-9A-Za-z\-_]{20,}/.test(k) || /^AQ\.[A-Za-z0-9\-_.]{40,}/.test(k)) return "prov-gemini";
  if (k.startsWith("gsk_")) return "prov-groq";
  if (k.startsWith("sk-or-")) return "prov-openrouter";
  if (k.startsWith("csk-")) return "prov-cerebras";
  return "unknown";
}

function upstreamForModel(model: string): string | null {
  if (MODEL_UPSTREAM[model]) return MODEL_UPSTREAM[model];
  if (model.startsWith("openai/") || model.startsWith("anthropic/")) return "prov-openrouter";
  if (model.startsWith("gemini-")) return "prov-gemini";
  return null;
}

function orderKeysForUpstream(keys: string[], target: string | null): string[] {
  if (!target) {
    const rank = (k: string) => {
      const u = detectKeyUpstream(k);
      if (u === "unknown") return 99;
      const i = UPSTREAM_PRIORITY.indexOf(u);
      return i === -1 ? 50 : i;
    };
    return [...keys].sort((a, b) => rank(a) - rank(b));
  }
  const match: string[] = [];
  const unknown: string[] = [];
  const rest: string[] = [];
  keys.forEach((k) => {
    const u = detectKeyUpstream(k);
    if (u === target) match.push(k);
    else if (u === "unknown") unknown.push(k);
    else rest.push(k);
  });
  return [...match, ...unknown, ...rest];
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const startTime = Date.now();
  try {
    const body = req.body || {};
    const { prompt, model, clientApiKey } = body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing prompt parameter" });
    }

    const keys: string[] = [];
    const push = (v: any) => {
      if (typeof v === "string" && v.trim()) keys.push(v.trim());
    };
    const authH = typeof req.headers?.authorization === "string" ? req.headers.authorization : "";
    const bm = authH.match(/^Bearer\s*(.*)$/i);
    const bearer = (bm ? bm[1] : authH).trim();
    push(req.headers["x-api-key"]);
    push(req.headers["x-gemini-key"]);
    if (bearer && bearer.toLowerCase() !== "bearer") push(bearer);
    if (Array.isArray(body.apiKeys)) body.apiKeys.forEach(push);
    push(clientApiKey);
    const uniq = [...new Set(keys)];
    if (uniq.length === 0) {
      return res.status(401).json({ error: "Login required: KEYS me key dalo." });
    }

    let wanted = (typeof model === "string" && model) || "gemini-flash-latest";
    if (LEGACY_GEMINI_ALIAS[wanted]) wanted = LEGACY_GEMINI_ALIAS[wanted];

    const target = upstreamForModel(wanted);
    const ordered = orderKeysForUpstream(uniq, target);
    const retryable = (st: number) =>
      [401, 403, 429, 500, 502, 503, 504].includes(st) || (!target && [400, 404].includes(st));

    let lastErr = "unknown error";
    const deadKeyPrefixes: string[] = [];
    for (let i = 0; i < ordered.length; i++) {
      const upId = detectKeyUpstream(ordered[i]);
      const up = UPSTREAMS[upId === "unknown" ? target || "prov-gemini" : upId];
      try {
        const resp = await fetch(`${up.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ordered[i]}`,
            "HTTP-Referer": "https://edge-ai-router.vercel.app",
            "X-Title": "Edge Router",
          },
          body: JSON.stringify({
            model: wanted,
            messages: [{ role: "user", content: prompt }],
            max_tokens: 600,
            temperature: 0.7,
          }),
        });
        const data: any = await resp.json().catch(() => null);
        if (resp.ok && data?.choices?.[0]) {
          const latencyMs = Date.now() - startTime;
          const text = data.choices[0].message?.content || "OK";
          const tokens = data.usage?.total_tokens || Math.max(15, Math.ceil(text.length / 4) + Math.ceil(prompt.length / 4));
          res.setHeader("X-Edge-Upstream", upId === "unknown" ? target || "prov-gemini" : upId);
          res.setHeader("X-Edge-Key-Index", String(i));
          return res.json({
            status: "ok",
            isLive: true,
            response: text,
            modelUsed: data.model || wanted,
            providerId: "Edge Router",
            providerName: up.name,
            upstreamId: upId === "unknown" ? target || "prov-gemini" : upId,
            keyIndex: i,
            key_prefix: typeof ordered[i] === "string" ? ordered[i].slice(0, 8) : "",
            dead_key_prefixes: deadKeyPrefixes,
            latencyMs,
            tokens,
          });
        }
        lastErr = data?.error?.message || data?.message || `Upstream HTTP ${resp.status}`;
        if (resp.status === 401 || resp.status === 403) deadKeyPrefixes.push(ordered[i].slice(0, 8));
        if (!retryable(resp.status)) break;
      } catch (e: any) {
        lastErr = `Upstream unreachable: ${e?.message || e}`;
      }
    }
    return res.status(502).json({ error: `${lastErr} (${ordered.length} keys tried)`, dead_key_prefixes: deadKeyPrefixes });
  } catch (err: any) {
    console.error("Inference route error:", err);
    const latencyMs = Date.now() - startTime;
    return res.status(500).json({
      error: err.message || "Inference failed",
      latencyMs,
    });
  }
}
