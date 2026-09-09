// Multi-provider OpenAI-compatible gateway — FULLY SELF-CONTAINED (no cross-file imports).
// Body: { providerId?, baseUrl? (custom), model?, messages, max_tokens?, temperature?, apiKeys?/clientApiKey? }
// Keys: x-api-key header OR Authorization Bearer OR body key(s). Tried in order (rotation).
// SSRF guard: catalog hosts + public-https-only custom hosts.
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

function collectKeys(req: any, body: any): string[] {
  const out: string[] = [];
  const push = (v: any) => {
    if (typeof v === "string" && v.trim()) out.push(v.trim());
  };
  push(req.headers["x-api-key"]);
  push(req.headers["x-gemini-key"]);
  push((req.headers.authorization || "").replace(/^Bearer\s+/i, ""));
  if (Array.isArray(body?.apiKeys)) body.apiKeys.forEach(push);
  push(body?.clientApiKey);
  return [...new Set(out)];
}

async function relayChatCompletion(opts: { baseUrl: string; apiKey: string; model: string; messages: any[]; maxTokens: number; temperature: number }): Promise<{ ok: boolean; status: number; data: any }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${opts.apiKey}`,
    "HTTP-Referer": "https://edge-ai-router.vercel.app",
    "X-Title": "Edge Router",
  };
  let resp: Response;
  try {
    resp = await fetch(`${opts.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({ model: opts.model, messages: opts.messages, max_tokens: opts.maxTokens, temperature: opts.temperature }),
    });
  } catch (e: any) {
    return { ok: false, status: 502, data: { message: `Upstream unreachable: ${e?.message || e}` } };
  }
  let data: any = null;
  try {
    data = await resp.json();
  } catch {
    data = { message: `Upstream bad response (HTTP ${resp.status})` };
  }
  return { ok: resp.ok, status: resp.status, data };
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "Method not allowed", type: "invalid_request_error" } });
  }
  const startTime = Date.now();
  try {
    const body = req.body || {};
    const { messages = [], model, max_tokens = 800, temperature = 0.7 } = body;
    const providerId: string = body.providerId || "prov-gemini";

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: { message: "Invalid messages array", type: "invalid_request_error" } });
    }

    const catalog = PROVIDER_CATALOG[providerId];
    let baseUrl = catalog?.baseUrl || "";
    const providerName = catalog?.name || providerId;
    if (!catalog) {
      const custom = typeof body.baseUrl === "string" ? body.baseUrl.trim() : "";
      if (!custom || !isAllowedUpstream(custom)) {
        return res.status(400).json({ error: { message: `Unknown providerId '${providerId}'. Use prov-gemini/prov-groq/prov-openrouter/prov-cerebras or a public https baseUrl.`, type: "invalid_request_error" } });
      }
      baseUrl = custom;
    }

    const keys = collectKeys(req, body);
    if (keys.length === 0) {
      return res.status(401).json({
        error: {
          message: `Is provider (${providerName}) ki key dalo. Login karke Provider Keys me add karo, fir Authorization: Bearer <KEY> bhejo.`,
          type: "authentication_error",
        },
      });
    }

    let wanted = (typeof model === "string" && model) || catalog?.defaultModel || "gemini-flash-latest";
    if (providerId === "prov-gemini" && LEGACY_GEMINI_ALIAS[wanted]) wanted = LEGACY_GEMINI_ALIAS[wanted];

    const openaiMessages = messages.map((m: any) => ({
      role: m.role === "system" || m.role === "assistant" || m.role === "user" ? m.role : "user",
      content: typeof m.content === "string" ? m.content : "",
    }));

    let lastErr = "unknown error";
    let lastStatus = 502;
    for (let i = 0; i < keys.length; i++) {
      const r = await relayChatCompletion({ baseUrl, apiKey: keys[i], model: wanted, messages: openaiMessages, maxTokens: max_tokens, temperature });
      if (r.ok) {
        const latencyMs = Date.now() - startTime;
        const d = r.data || {};
        const choice = d.choices?.[0];
        const responseText = choice?.message?.content || "";
        const usage = d.usage || {};
        const promptTokens = usage.prompt_tokens ?? openaiMessages.reduce((acc: number, m: any) => acc + Math.ceil((m.content || "").length / 4), 0);
        const completionTokens = usage.completion_tokens ?? Math.ceil(responseText.length / 4);
        res.setHeader("X-Edge-Provider", providerId);
        res.setHeader("X-Edge-Key-Index", String(i));
        res.setHeader("X-Edge-Keys-Tried", String(i + 1));
        res.setHeader("X-Edge-Latency-Ms", latencyMs.toString());
        res.setHeader("X-Edge-Router-Region", "global-anycast");
        return res.json({
          id: d.id || "chatcmpl-" + Math.random().toString(36).substring(2, 11),
          object: "chat.completion",
          created: d.created || Math.floor(Date.now() / 1000),
          model: d.model || wanted,
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: responseText },
              finish_reason: choice?.finish_reason || "stop",
            },
          ],
          usage: {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: promptTokens + completionTokens,
          },
          edge_routing: {
            provider: providerName,
            provider_id: providerId,
            key_index: i,
            keys_tried: i + 1,
            latency_ms: latencyMs,
            status: "200 OK",
          },
        });
      }
      lastStatus = r.status;
      lastErr = r.data?.error?.message || r.data?.message || `Upstream HTTP ${r.status}`;
      if (![401, 403, 429, 500, 502, 503, 504].includes(r.status)) break;
    }

    return res.status(502).json({
      error: {
        message: `${providerName}: ${lastErr} (${keys.length} key${keys.length > 1 ? "s" : ""} tried)`,
        type: "upstream_error",
        provider_id: providerId,
      },
    });
  } catch (err: any) {
    console.error("Proxy completions error:", err);
    return res.status(500).json({
      error: {
        message: err.message || "Proxy completion failed",
        type: "internal_server_error",
      },
    });
  }
}
