// Universal gateway — ONE provider, model naam se auto-route. FULLY SELF-CONTAINED.
// Body: { model, messages, max_tokens?, temperature?, apiKeys?/clientApiKey? } (+ legacy providerId/baseUrl tolerated).
// Keys: master key (er1...) OR x-api-key header OR Authorization Bearer OR body key(s).
// Har key ka upstream prefix se auto-detect; model ke hisaab se order; rotation + dead-report.
// SSRF guard: catalog hosts + public-https-only custom hosts.
import crypto from "node:crypto";
import { inflateSync } from "node:zlib";

const MASTER_PREFIX = "er1.";
const UNIVERSAL_ID = "prov-universal";

function masterSecret(): Buffer {
  return crypto
    .createHash("sha256")
    .update(process.env.MASTER_KEY_SECRET || "er-dev-fallback-secret-v1-do-not-use-in-prod")
    .digest();
}

function masterDecrypt(token: string): any {
  if (typeof token !== "string" || !token.startsWith(MASTER_PREFIX)) {
    const e: any = new Error("not-a-master-key");
    e.code = "NOT_MASTER";
    throw e;
  }
  let payload: any;
  try {
    const raw = Buffer.from(token.slice(MASTER_PREFIX.length), "base64url");
    if (raw.length < 29) throw new Error("bad");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(raw.length - 16);
    const ct = raw.subarray(12, raw.length - 16);
    const d = crypto.createDecipheriv("aes-256-gcm", masterSecret(), iv);
    d.setAuthTag(tag);
    payload = JSON.parse(inflateSync(Buffer.concat([d.update(ct), d.final()])).toString("utf8"));
  } catch (err: any) {
    if (err?.code === "NOT_MASTER") throw err;
    const e: any = new Error("bad-master-key");
    e.code = "BAD_MASTER";
    throw e;
  }
  if (!payload || payload.v !== 1 || typeof payload.exp !== "number" || typeof payload.keys !== "object") {
    const e: any = new Error("bad-master-key");
    e.code = "BAD_MASTER";
    throw e;
  }
  if (payload.exp <= Date.now()) {
    const e: any = new Error("master-key-expired");
    e.code = "EXPIRED";
    throw e;
  }
  return payload;
}

// Revoked-master check (KV). Missing KV / errors => fail-open (allow), logged.
async function isMasterRevoked(mid: string): Promise<boolean> {
  const url = process.env.KV_REST_API_URL;
  const tok = process.env.KV_REST_API_TOKEN;
  if (!url || !tok || !mid) return false;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2500);
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify(["GET", `er:revoked:${mid}`]),
      signal: ctl.signal,
    });
    clearTimeout(t);
    const j: any = await r.json().catch(() => null);
    return j?.result === "1";
  } catch (e) {
    console.warn("KV GET fail-open:", (e as any)?.message || e);
    return false;
  }
}

const UPSTREAMS: Record<string, { name: string; baseUrl: string; defaultModel: string }> = {
  "prov-gemini": { name: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", defaultModel: "gemini-flash-latest" },
  "prov-groq": { name: "Groq", baseUrl: "https://api.groq.com/openai/v1", defaultModel: "llama-3.3-70b-versatile" },
  "prov-openrouter": { name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", defaultModel: "openai/gpt-4o-mini" },
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
  "openai/gpt-4o-mini": "prov-openrouter",
  "meta-llama/llama-3.3-70b-instruct": "prov-openrouter",
  "anthropic/claude-3.5-haiku": "prov-openrouter",
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

export function detectKeyUpstream(key: string): string {
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

// Affinity-match keys first (stable), then unknown-prefix, then rest.
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

function bearerToken(req: any): string {
  const h = typeof req.headers?.authorization === "string" ? req.headers.authorization : "";
  const m = h.match(/^Bearer\s*(.*)$/i);
  const tok = (m ? m[1] : h).trim();
  // Bare "Bearer" (no token) is not a key
  if (!tok || tok.toLowerCase() === "bearer") return "";
  return tok;
}

function collectKeys(req: any, body: any): string[] {
  const out: string[] = [];
  const push = (v: any) => {
    if (typeof v === "string" && v.trim()) out.push(v.trim());
  };
  push(req.headers["x-api-key"]);
  push(req.headers["x-gemini-key"]);
  push(bearerToken(req));
  if (Array.isArray(body?.apiKeys)) body.apiKeys.forEach(push);
  push(body?.clientApiKey);
  return [...new Set(out)];
}

// Master pools flatten: universal first, then legacy ids (purane masters ke liye).
function flattenMasterPools(payload: any): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const take = (arr: any) => {
    if (!Array.isArray(arr)) return;
    arr.forEach((e: any) => {
      const k = typeof e === "string" ? e : e?.k;
      if (typeof k === "string" && k.trim() && !seen.has(k.trim())) {
        seen.add(k.trim());
        out.push(k.trim());
      }
    });
  };
  const pools = payload?.keys || {};
  take(pools[UNIVERSAL_ID]);
  ["prov-gemini", "prov-groq", "prov-openrouter", "prov-cerebras"].forEach((pid) => take(pools[pid]));
  Object.keys(pools).forEach((pid) => {
    if (pid !== UNIVERSAL_ID) take(pools[pid]);
  });
  return out;
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

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: { message: "Invalid messages array", type: "invalid_request_error" } });
    }

    // Custom baseUrl (legacy/custom providers) — providerId ab zaroori nahi.
    let customBase: string | null = null;
    const customRaw = typeof body.baseUrl === "string" ? body.baseUrl.trim() : "";
    if (customRaw) {
      if (!isAllowedUpstream(customRaw)) {
        return res.status(400).json({ error: { message: "baseUrl public https hona chahiye.", type: "invalid_request_error" } });
      }
      customBase = customRaw;
    }

    let keys = collectKeys(req, body);
    const maybeMaster = keys.find((k) => k.startsWith(MASTER_PREFIX)) || (typeof body.masterKey === "string" && body.masterKey.trim().startsWith(MASTER_PREFIX) ? body.masterKey.trim() : "");
    if (maybeMaster) {
      let payload: any;
      try {
        payload = masterDecrypt(maybeMaster);
      } catch (e: any) {
        const msg =
          e?.code === "EXPIRED"
            ? "Master key expire ho gayi — site se Regenerate karo."
            : "Master key invalid hai — site se dobara copy karo.";
        return res.status(401).json({ error: { message: msg, type: "authentication_error" } });
      }
      if (await isMasterRevoked(payload.mid)) {
        return res.status(401).json({ error: { message: "Ye master key revoke (delete) ho chuki hai — nayi generate karo.", type: "authentication_error" } });
      }
      keys = flattenMasterPools(payload);
      if (keys.length === 0) {
        return res.status(401).json({ error: { message: "Is master key me koi key nahi hai — site pe KEYS me add karke Regenerate karo.", type: "authentication_error" } });
      }
    }
    if (keys.length === 0) {
      return res.status(401).json({
        error: {
          message: "API key dalo: site pe KEYS me add karo, fir link + master key (ya direct key) bhejo.",
          type: "authentication_error",
        },
      });
    }

    let wanted = (typeof model === "string" && model) || "gemini-flash-latest";
    if (LEGACY_GEMINI_ALIAS[wanted]) wanted = LEGACY_GEMINI_ALIAS[wanted];

    const openaiMessages = messages.map((m: any) => ({
      role: m.role === "system" || m.role === "assistant" || m.role === "user" ? m.role : "user",
      content: typeof m.content === "string" ? m.content : "",
    }));

    // Model -> upstream; unknown model -> affinity order me try (404/400 pe next).
    const target = customBase ? null : upstreamForModel(wanted);
    const ordered = customBase ? keys : orderKeysForUpstream(keys, target);
    const retryable = (st: number) =>
      [401, 403, 429, 500, 502, 503, 504].includes(st) || (!target && !customBase && [400, 404].includes(st));

    let lastErr = "unknown error";
    const deadKeyIndexes: number[] = [];
    const deadKeyPrefixes: string[] = [];
    for (let i = 0; i < ordered.length; i++) {
      const upId = customBase ? "custom" : detectKeyUpstream(ordered[i]);
      const up = customBase ? { name: "Custom", baseUrl: customBase } : UPSTREAMS[upId === "unknown" ? (target || "prov-gemini") : upId];
      const r = await relayChatCompletion({ baseUrl: up.baseUrl, apiKey: ordered[i], model: wanted, messages: openaiMessages, maxTokens: max_tokens, temperature });
      if (r.ok) {
        const latencyMs = Date.now() - startTime;
        const d = r.data || {};
        const choice = d.choices?.[0];
        const responseText = choice?.message?.content || "";
        const usage = d.usage || {};
        const promptTokens = usage.prompt_tokens ?? openaiMessages.reduce((acc: number, m: any) => acc + Math.ceil((m.content || "").length / 4), 0);
        const completionTokens = usage.completion_tokens ?? Math.ceil(responseText.length / 4);
        const servedId = customBase ? "custom" : upId === "unknown" ? (target || "prov-gemini") : upId;
        res.setHeader("X-Edge-Upstream", servedId);
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
            provider: customBase ? "Custom" : UPSTREAMS[servedId]?.name || servedId,
            provider_id: servedId,
            gateway: UNIVERSAL_ID,
            key_index: i,
            key_prefix: typeof ordered[i] === "string" ? ordered[i].slice(0, 8) : "",
            keys_tried: i + 1,
            dead_key_indexes: deadKeyIndexes,
            dead_key_prefixes: deadKeyPrefixes,
            latency_ms: latencyMs,
            status: "200 OK",
          },
        });
      }
      lastErr = r.data?.error?.message || r.data?.message || `Upstream HTTP ${r.status}`;
      // 401/403 = definitively dead key -> report for auto-quarantine (never on 429/5xx)
      if ((r.status === 401 || r.status === 403) && typeof ordered[i] === "string") {
        deadKeyIndexes.push(i);
        deadKeyPrefixes.push(ordered[i].slice(0, 8));
      }
      if (!retryable(r.status)) break;
    }

    return res.status(502).json({
      error: {
        message: `${lastErr} (${ordered.length} keys tried)`,
        type: "upstream_error",
        dead_key_indexes: deadKeyIndexes,
        dead_key_prefixes: deadKeyPrefixes,
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
