// In-app Tester inference — FULLY SELF-CONTAINED (no cross-file imports).
// Body: { prompt, model?, providerId?, baseUrl?, apiKeys?/clientApiKey? }.
// Tries provider keys in order; 401 when none configured (no fake success).
const PROVIDER_CATALOG: Record<string, { name: string; baseUrl: string; defaultModel: string }> = {
  "prov-gemini": { name: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", defaultModel: "gemini-flash-latest" },
  "prov-groq": { name: "Groq", baseUrl: "https://api.groq.com/openai/v1", defaultModel: "llama-3.3-70b-versatile" },
  "prov-openrouter": { name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", defaultModel: "openai/gpt-4o-mini" },
  "prov-cerebras": { name: "Cerebras", baseUrl: "https://api.cerebras.ai/v1", defaultModel: "llama-3.3-70b" },
};

const LEGACY_GEMINI_ALIAS: Record<string, string> = {
  "gemini-2.5-flash": "gemini-flash-latest",
  "gemini-2.0-flash": "gemini-flash-latest",
  "gemini-1.5-flash": "gemini-flash-latest",
  "gemini-1.5-pro": "gemini-pro-latest",
  "gemini-2.0-flash-lite": "gemini-flash-lite-latest",
};

function isAllowedUpstream(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (/(^|\.)(generativelanguage\.googleapis\.com|api\.groq\.com|openrouter\.ai|api\.cerebras\.ai)$/.test(host)) return true;
    if (!host.includes(".")) return false;
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return false;
    if (/^(10\.|127\.|192\.168\.|169\.254\.|0\.0\.0\.0)/.test(host)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    if (/^[0-9a-f:]*:[0-9a-f:]+$/i.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const startTime = Date.now();
  try {
    const body = req.body || {};
    const { prompt, model, clientApiKey } = body;
    const providerId: string = body.providerId || "prov-gemini";

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing prompt parameter" });
    }

    const catalog = PROVIDER_CATALOG[providerId];
    let baseUrl = catalog?.baseUrl || "";
    const providerName = catalog?.name || providerId;
    if (!catalog) {
      const custom = typeof body.baseUrl === "string" ? body.baseUrl.trim() : "";
      if (!custom || !isAllowedUpstream(custom)) {
        return res.status(400).json({ error: `Unknown providerId '${providerId}'.` });
      }
      baseUrl = custom;
    }

    const keys: string[] = [];
    const push = (v: any) => {
      if (typeof v === "string" && v.trim()) keys.push(v.trim());
    };
    push(req.headers["x-api-key"]);
    push(req.headers["x-gemini-key"]);
    push((req.headers.authorization || "").replace(/^Bearer\s+/i, ""));
    if (Array.isArray(body.apiKeys)) body.apiKeys.forEach(push);
    push(clientApiKey);
    const uniq = [...new Set(keys)];
    if (uniq.length === 0) {
      return res.status(401).json({ error: `Login required: ${providerName} ki key dalo (Provider Keys).` });
    }

    let wanted = (typeof model === "string" && model) || catalog?.defaultModel || "gemini-flash-latest";
    if (providerId === "prov-gemini" && LEGACY_GEMINI_ALIAS[wanted]) wanted = LEGACY_GEMINI_ALIAS[wanted];

    let lastErr = "unknown error";
    for (let i = 0; i < uniq.length; i++) {
      try {
        const resp = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${uniq[i]}`,
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
          res.setHeader("X-Edge-Provider", providerId);
          res.setHeader("X-Edge-Key-Index", String(i));
          return res.json({
            status: "ok",
            isLive: true,
            response: text,
            modelUsed: data.model || wanted,
            providerId,
            providerName,
            keyIndex: i,
            latencyMs,
            tokens,
          });
        }
        lastErr = data?.error?.message || data?.message || `Upstream HTTP ${resp.status}`;
        if (![401, 403, 429, 500, 502, 503, 504].includes(resp.status)) break;
      } catch (e: any) {
        lastErr = `Upstream unreachable: ${e?.message || e}`;
      }
    }
    return res.status(502).json({ error: `${providerName}: ${lastErr} (${uniq.length} keys tried)` });
  } catch (err: any) {
    console.error("Inference route error:", err);
    const latencyMs = Date.now() - startTime;
    return res.status(500).json({
      error: err.message || "Inference failed",
      latencyMs,
    });
  }
}
