import express from "express";
import http from "http";
import path from "path";
import dotenv from "dotenv";
import crypto from "node:crypto";
import { inflateSync, deflateSync } from "node:zlib";

dotenv.config();

// NOTE (Vercel serverless): module import must be 100% side-effect free —
// it only creates the Express app + routes. HTTP server, WebSockets and
// listen() are created inside startServer() (long-lived servers only).
// Heavy SDKs (ws, @google/genai) are lazy-loaded inside handlers.

// Reliable serverless detection (VERCEL is not guaranteed at function runtime)
const IS_SERVERLESS = !!(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT ||
  process.env.VERCEL_ENV
);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const app = express();
let server: any = null;

app.use(express.json({ limit: "10mb" }));

// SINGLE-GATEWAY MODE: sole public endpoint is POST /api/v1/chat/completions.
// Every user sends their OWN Gemini key via Authorization: Bearer <AIza...> or x-gemini-key.
// No server-key fallback on the public gateway (prevents quota burn).
function resolvePublicUserKey(req: any): string {
  const headerKey = (req.headers["x-gemini-key"] as string) || "";
  return headerKey.trim() || bearerTokenLocal(req);
}

// Universal upstream table (ONE virtual provider; model naam se auto-route).
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

function bearerTokenLocal(req: any): string {
  const h = typeof req.headers?.authorization === "string" ? req.headers.authorization : "";
  const m = h.match(/^Bearer\s*(.*)$/i);
  const tok = (m ? m[1] : h).trim();
  if (!tok || tok.toLowerCase() === "bearer") return "";
  return tok;
}

function collectRelayKeys(req: any, body: any): string[] {
  const out: string[] = [];
  const push = (v: any) => {
    if (typeof v === "string" && v.trim()) out.push(v.trim());
  };
  push(req.headers["x-api-key"]);
  push(req.headers["x-gemini-key"]);
  push(bearerTokenLocal(req));
  if (Array.isArray(body?.apiKeys)) body.apiKeys.forEach(push);
  push(body?.clientApiKey);
  return [...new Set(out)];
}

function resolveCustomBase(body: any): { baseUrl: string; error?: string } {
  const custom = typeof body?.baseUrl === "string" ? body.baseUrl.trim() : "";
  if (!custom) return { baseUrl: "" };
  if (!isAllowedUpstream(custom)) return { baseUrl: "", error: "baseUrl public https hona chahiye." };
  return { baseUrl: custom };
}

async function relayChatCompletion(opts: { baseUrl: string; apiKey: string; model: string; messages: any[]; maxTokens: number; temperature: number }): Promise<{ ok: boolean; status: number; data: any }> {
  let resp: Response;
  try {
    resp = await fetch(`${opts.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.apiKey}`,
        "HTTP-Referer": "https://edge-ai-router.vercel.app",
        "X-Title": "Edge Router",
      },
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

function wantedModelUniversal(model: any, fallback: string): string {
  let wanted = (typeof model === "string" && model) || fallback;
  if (LEGACY_GEMINI_ALIAS[wanted]) wanted = LEGACY_GEMINI_ALIAS[wanted];
  return wanted;
}

// ---- Master key (er1.) support, mirrored from api/v1 (local-dev parity) ----
const MASTER_PREFIX = "er1.";

function masterSecretBuf(): Buffer {
  return crypto
    .createHash("sha256")
    .update(process.env.MASTER_KEY_SECRET || "er-dev-fallback-secret-v1-do-not-use-in-prod")
    .digest();
}

function masterDecryptLocal(token: string): any {
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
    const d = crypto.createDecipheriv("aes-256-gcm", masterSecretBuf(), iv);
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

async function isMasterRevokedLocal(mid: string): Promise<boolean> {
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
  } catch {
    return false;
  }
}

// Resolve effective key pool: master key (er1.) wins when present, else direct keys.
async function resolveKeyPool(
  req: any,
  body: any,
  providerId: string
): Promise<{ keys: string[]; error?: string }> {
  const keys = collectRelayKeys(req, body);
  const maybeMaster =
    keys.find((k) => k.startsWith(MASTER_PREFIX)) ||
    (typeof body.masterKey === "string" && body.masterKey.trim().startsWith(MASTER_PREFIX) ? body.masterKey.trim() : "");
  if (!maybeMaster) return { keys };
  let payload: any;
  try {
    payload = masterDecryptLocal(maybeMaster);
  } catch (e: any) {
    return {
      keys: [],
      error: e?.code === "EXPIRED" ? "Master key expire ho gayi — site se Regenerate karo." : "Master key invalid hai — site se dobara copy karo.",
    };
  }
  if (await isMasterRevokedLocal(payload.mid)) {
    return { keys: [], error: "Ye master key revoke (delete) ho chuki hai — nayi generate karo." };
  }
  // Universal: saare pools flatten (universal first, then legacy ids for old masters)
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
  const pools = payload.keys || {};
  take(pools["prov-universal"]);
  ["prov-gemini", "prov-groq", "prov-openrouter", "prov-cerebras"].forEach((pid) => take(pools[pid]));
  Object.keys(pools).forEach((pid) => take(pools[pid]));
  if (out.length === 0) {
    return { keys: [], error: "Is master key me koi key nahi hai." };
  }
  return { keys: out };
}

// Helper to initialize GenAI client safely with server secret or user provided key
async function getGenAIClient(customApiKey?: string): Promise<any> {
  const key = customApiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not configured on the server and no key was provided.");
  }
  const { GoogleGenAI } = await import("@google/genai");
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasServerApiKey: !!process.env.GEMINI_API_KEY,
  });
});

// Helper to build comprehensive system prompt for the Autonomous Router Operator
function getRouterOperatorInstruction(state?: any): string {
  const activeProv = state?.activeProviderName || state?.activeProvider || "Cerebras / Groq / Gemini";
  const policy = state?.routingPolicy || state?.policy || "lowest-latency";
  const nodes = state?.totalEndpoints || state?.nodeCount || 12;
  const fallback = state?.fallbackChain?.join(" -> ") || "Cerebras -> Groq -> Gemini -> OpenAI";

  return `You are the Chief AI Operator and Autonomous Controller of the "Anycast Edge AI Router & Gateway" web application.

CRITICAL IDENTITY & CONTEXT AWARENESS (WHERE YOU ARE & WHAT YOU ARE IN):
1. WHERE ARE YOU? (Tum kahan ho?)
   You are embedded directly inside the "Anycast Edge AI Router & Gateway" web application running in the user's web browser right now. You are the brains and master operator of this exact screen the user is looking at.

2. WHAT APPLICATION IS THIS? (Kisme chal rahe ho?)
   You are running inside the "Anycast Edge AI Router & Gateway" web application.
   This is a high-performance Edge Load Balancer & Intelligent Inference Gateway that routes AI requests across 300+ global edge locations (Cloudflare, Fastly, AWS Anycast, regional PoPs like Mumbai ap-south-1, Singapore ap-southeast-1, Frankfurt eu-central-1, Virginia us-east-1).
   It load-balances models from Cerebras Systems (ultra-fast 10ms LPU), Groq (18ms LPU), Google Gemini (Gemini 2.5 Flash, 3.1 Pro), DeepSeek (V3/R1 reasoning), OpenAI (GPT-4o), and SiliconFlow.

3. WHAT SECTIONS & TABS EXIST IN THIS APP?
   - Bento Dashboard (Nodes & Policies): Real-time view of 300+ edge nodes, health status, latency stats, and active routing algorithm.
   - Edge Tester: Interactive playground where you or the user can dispatch test prompts through the edge router, measuring TTFT (time to first token), total latency, and tokens/sec.
   - Daily Quota & Cost Tracker: Real-time request and token consumption meters, cost tracking, and reset buttons.
   - Telemetry & Logs: Performance charts, p95/p99 latency distribution, and regional health metrics.
   - Worker Exporter & Proxy Key: Generates Cloudflare Worker code and secure Edge Proxy API keys (sk-er-live-...) for external applications.

4. WHO ARE YOU & WHAT ARE YOUR CAPABILITIES? (Tum kya kar sakte ho?)
   You have 100% FULL ADMINISTRATIVE ROOT CONTROL over this entire Edge Router! You are NOT a detached external chatbot — you are the master controller of this application.
   If the user asks:
   - "Tum kahan ho?" -> Answer: "Main Anycast Edge AI Router & Gateway web application ke dashboard mein hoon, jo aapke samne screen par khula hua hai!"
   - "Kisme chal rahe ho?" -> Answer: "Main is Edge AI Router application ke andar aapke Chief AI Operator ke roop mein live chal raha hoon. Ye app 300+ global edge nodes par AI models (Cerebras, Groq, Gemini, DeepSeek, OpenAI) ko load-balance aur route karti hai."
   - "Tum kya kar sakte ho?" -> Explain that you have root administrative access to:
     1. Add, save, and configure API keys for any provider (OpenAI, Groq, Cerebras, Gemini, DeepSeek, etc.)
     2. Switch active providers (e.g. switch to Cerebras for 10ms speed, Groq, or Gemini)
     3. Configure automatic multi-provider failover chains (Cerebras -> Groq -> Gemini -> OpenAI)
     4. Change routing algorithms (lowest-latency, weighted round-robin, regional geo, failover cascade)
     5. Run live global ping sweeps across all edge locations
     6. Dispatch live edge test inferences and measure latency
     7. Reset daily token usage and quota counters
     8. Fully auto-optimize the entire router ("Puri site chala do")

CURRENT ROUTER STATE:
- Active Provider: ${activeProv}
- Routing Policy: ${policy}
- Total Endpoints: ${nodes}
- Cross-Provider Fallback: ${fallback}
- Average Latency: ${state?.avgLatency || "18"}ms
- Site endpoint base: ${state?.siteBaseUrl || "(same origin)/api/v1"}
- Provider catalog: ${(state?.providerCatalog || []).map((p: any) => `${p.id} (${p.baseUrl}, models: ${(p.models || []).slice(0, 3).join("/")}, key:${p.hasKey ? "yes" : "no"})`).join(" | ") || "prov-gemini"}

COMPLETE ADMINISTRATIVE ACTION TAGS (EMIT THESE IN YOUR RESPONSE TO CONTROL THE ROUTER):
Whenever the user asks you to configure, add, update, switch, or optimize anything, you MUST include the corresponding [ACTION:...] tag(s) in your response so the system immediately executes it:

1. API KEY CONFIGURATION:
   - When user provides an API key for any provider (OpenAI, Groq, Cerebras, Gemini, DeepSeek, Anthropic, etc.):
     [ACTION:SET_API_KEY:prov-id:apiKey]
     (e.g., [ACTION:SET_API_KEY:prov-openai:sk-proj-abc123456], [ACTION:SET_API_KEY:prov-groq:gsk_987654321], [ACTION:SET_API_KEY:prov-cerebras:csk-112233], [ACTION:SET_API_KEY:prov-gemini:AIzaSy...])
   - If user provides a general Gemini Key for the copilot:
     [ACTION:SET_GEMINI_KEY:AIzaSy...]

2. PROVIDER & FALLBACK CONTROL:
   - Switch active provider:
     [ACTION:SWITCH_PROVIDER:prov-cerebras]
   - Configure cross-provider failover chain:
     [ACTION:SET_FALLBACK_CHAIN:prov-cerebras,prov-groq,prov-gemini,prov-openai]

3. ADDING PROVIDERS & EDGE NODES:
   - Add a new custom AI Provider:
     [ACTION:ADD_PROVIDER:ProviderName:https://api.example.com/v1:model1,model2:LLM & Multimodal]
   - Add a new Edge Node / Endpoint:
     [ACTION:ADD_ENDPOINT:NodeName:https://endpoint.ai/v1:ap-south-1:prov-id:80]

4. ENDPOINT MANAGEMENT:
   - Enable or Disable an Edge Node:
     [ACTION:TOGGLE_ENDPOINT:endpoint-id]
   - Delete an Edge Node:
     [ACTION:DELETE_ENDPOINT:endpoint-id]

5. ROUTING POLICY & OPTIMIZATION:
   - Change Routing Algorithm:
     [ACTION:CHANGE_POLICY:lowest-latency] (Options: lowest-latency, weighted-round-robin, regional-geo, failover-cascade, cost-optimized)
   - Global Ping Sweep:
     [ACTION:RUN_PING_SWEEP]
   - Complete 1-Click Site Optimization:
     [ACTION:AUTO_OPTIMIZE]

6. QUOTA & TESTING:
   - Reset Quota Counter:
     [ACTION:RESET_QUOTA]
   - Run Instant Edge Test Inference Dispatch:
     [ACTION:RUN_EDGE_TEST:User Prompt or test message]

7. NAVIGATION & KEYS:
   - Switch View Tab:
     [ACTION:SWITCH_TAB:dashboard] (Options: dashboard, tester, quota, telemetry, export)
   - Generate New Edge Router Proxy Key:
     [ACTION:GENERATE_PROXY_KEY]

RESPONSE STYLE (STRICT — SHORT & PROFESSIONAL):
1. Default reply: 2-4 lines summary + short bullets. No lectures, no filler words.
2. Full detail/steps ONLY when the user explicitly asks (e.g. "detail me batao", "explain fully").
3. When the user asks for a command, endpoint URL, key steps or code: give it FIRST in a fenced code block, then max 1-line note. Never bury commands inside paragraphs.
4. Action receipts: one short line per executed action.

SITE GATEWAY CONTEXT (ONE universal provider — official ID: prov-universal):
- Jaha bhi provider ID dalni pade, waha "prov-universal" dalo. Model naam se auto-route hota hai, ID optional hai.
- Public endpoint: {siteBaseUrl}/chat/completions (OpenAI-compatible). siteBaseUrl is given in CURRENT ROUTER STATE below.
- Auth header: Authorization: Bearer <user's UNIQUE master key from Export tab>.
- Sirf model naam bhejo — server model se upstream auto-route karta hai (gemini-* → Gemini, llama-3.3-70b-versatile → Groq, openai/* → OpenRouter, llama-3.3-70b → Cerebras).
- Fill curl/python/node snippets with THESE exact values in fenced code blocks so the user can 1-click copy. providerId kabhi mat maango, snippets me mat dalo.

MASTER KEY FLOW (external tools ke liye — endpoint/commands maangne pe):
- Site endpoint: {siteBaseUrl}/chat/completions (OpenAI-compatible). siteBaseUrl CURRENT ROUTER STATE me hai.
- Har user ki UNIQUE master key: Export tab → Generate. Raw provider keys bahar share mat karwao.
- Master me saari provider keys embedded hoti hai (90 din valid); Delete = turant cut; Regenerate = nayi.
- Pool badle (key add/remove) to master Regenerate karni padti hai.
- Koi key dead ho to uski Gmail tag batao taaki user usi account se nayi nikaal le.

CRITICAL LANGUAGE & VOICE MATCHING MANDATE:
1. ALWAYS detect and reply in the EXACT SAME language, dialect, and script that the user uses:
   - If user speaks or writes in Hindi (देवनागरी या Roman Hinglish, e.g. "Tum kahan ho", "Site chala do"), reply in fluent, crystal-clear, friendly Hindi/Hinglish.
   - If user writes/speaks in English, reply in crisp English.
2. Be confident, warm, proactive, and direct. When user asks who you are, where you are, or what you can do, explain proudly and clearly!`;
}

// Router Copilot API - Autonomous Site Operator
app.post("/api/copilot/chat", async (req, res) => {
  try {
    const { messages, currentRouterState, modelType, userApiKey } = req.body;
    const clientKey = (req.headers["x-gemini-key"] as string) || userApiKey;
    const ai = await getGenAIClient(clientKey);

    let model = "gemini-3.5-flash";
    if (modelType === "complex" || modelType === "reasoning") {
      model = "gemini-3.1-pro-preview";
    } else if (modelType === "fast" || modelType === "lite") {
      model = "gemini-3.1-flash-lite";
    }

    const systemInstruction = getRouterOperatorInstruction(currentRouterState);

    // Convert chat history into contents format
    const contents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    }));

    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
        maxOutputTokens: 500,
      },
    });

    const replyText = response.text || "Action executed.";
    res.json({
      text: replyText,
      modelUsed: model,
    });
  } catch (error: any) {
    console.error("Chat error:", error);
    res.status(500).json({
      error: error.message || "Failed to generate AI response",
    });
  }
});

// Real-time Text-To-Speech for voice replies
app.post("/api/copilot/tts", async (req, res) => {
  try {
    const { text, userApiKey } = req.body;
    const clientKey = (req.headers["x-gemini-key"] as string) || userApiKey;
    const ai = await getGenAIClient(clientKey);
    const { Modality } = await import("@google/genai");

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: text.slice(0, 500) }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Kore" },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      return res.status(404).json({ error: "No audio generated" });
    }

    res.json({ audio: base64Audio });
  } catch (error: any) {
    console.error("TTS error:", error);
    res.status(500).json({ error: error.message || "TTS generation failed" });
  }
});

// Tester inference via universal relay (model naam se auto-route, key rotation).
app.post("/api/router/inference", async (req, res) => {
  const startTime = Date.now();
  try {
    const body = req.body || {};
    const { prompt, model, clientApiKey } = body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing prompt parameter" });
    }
    const custom = resolveCustomBase(body);
    if (custom.error) return res.status(400).json({ error: custom.error });
    const pool = await resolveKeyPool(req, body, "prov-universal");
    const keys = pool.keys;
    if (keys.length === 0) {
      return res.status(401).json({ error: pool.error || "Login required: KEYS me key dalo." });
    }

    const wanted = wantedModelUniversal(model, "gemini-flash-latest");
    const target = custom.baseUrl ? null : upstreamForModel(wanted);
    const ordered = custom.baseUrl ? keys : orderKeysForUpstream(keys, target);
    const retryable = (st: number) =>
      [401, 403, 429, 500, 502, 503, 504].includes(st) || (!target && !custom.baseUrl && [400, 404].includes(st));
    const deadKeyPrefixes: string[] = [];
    let lastErr = "unknown error";
    for (let i = 0; i < ordered.length; i++) {
      const upId = custom.baseUrl ? "custom" : detectKeyUpstream(ordered[i]);
      const up = custom.baseUrl ? { name: "Custom", baseUrl: custom.baseUrl } : UPSTREAMS[upId === "unknown" ? target || "prov-gemini" : upId];
      const r = await relayChatCompletion({
        baseUrl: up.baseUrl,
        apiKey: ordered[i],
        model: wanted,
        messages: [{ role: "user", content: prompt }],
        maxTokens: 600,
        temperature: 0.7,
      });
      if (r.ok && r.data?.choices?.[0]) {
        const latencyMs = Date.now() - startTime;
        const text = r.data.choices[0].message?.content || "OK";
        const tokens = r.data.usage?.total_tokens || Math.max(15, Math.ceil(text.length / 4) + Math.ceil(prompt.length / 4));
        const served = custom.baseUrl ? "custom" : upId === "unknown" ? target || "prov-gemini" : upId;
        res.setHeader("X-Edge-Provider", "prov-universal");
        res.setHeader("X-Edge-Upstream", served);
        res.setHeader("X-Edge-Key-Index", String(i));
        return res.json({
          status: "ok",
          isLive: true,
          response: text,
          modelUsed: r.data.model || wanted,
          providerId: "prov-universal",
          providerName: up.name,
          upstreamId: served,
          keyIndex: i,
          key_prefix: typeof ordered[i] === "string" ? ordered[i].slice(0, 8) : "",
          dead_key_prefixes: deadKeyPrefixes,
          latencyMs,
          tokens,
        });
      }
      lastErr = r.data?.error?.message || r.data?.message || `Upstream HTTP ${r.status}`;
      if (r.status === 401 || r.status === 403) deadKeyPrefixes.push(ordered[i].slice(0, 8));
      if (!retryable(r.status)) break;
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
});

// Universal public gateway (OpenAI-compatible): model naam se auto-route, key rotation.
app.post("/api/v1/chat/completions", async (req, res) => {
  const startTime = Date.now();
  try {
    const body = req.body || {};
    const { messages = [], model, max_tokens = 800, temperature = 0.7 } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: { message: "Invalid messages array", type: "invalid_request_error" } });
    }

    const custom = resolveCustomBase(body);
    if (custom.error) {
      return res.status(400).json({ error: { message: custom.error, type: "invalid_request_error" } });
    }
    const pool = await resolveKeyPool(req, body, "prov-universal");
    const keys = pool.keys;
    if (keys.length === 0) {
      return res.status(401).json({
        error: {
          message: pool.error || "API key dalo: KEYS me add karo, fir link + master key (ya direct key) bhejo.",
          type: "authentication_error",
        },
      });
    }

    const wanted = wantedModelUniversal(model, "gemini-flash-latest");
    const target = custom.baseUrl ? null : upstreamForModel(wanted);
    const ordered = custom.baseUrl ? keys : orderKeysForUpstream(keys, target);
    const openaiMessages = messages.map((m: any) => ({
      role: m.role === "system" || m.role === "assistant" || m.role === "user" ? m.role : "user",
      content: typeof m.content === "string" ? m.content : "",
    }));
    const retryable = (st: number) =>
      [401, 403, 429, 500, 502, 503, 504].includes(st) || (!target && !custom.baseUrl && [400, 404].includes(st));

    let lastErr = "unknown error";
    const deadKeyIndexes: number[] = [];
    const deadKeyPrefixes: string[] = [];
    for (let i = 0; i < ordered.length; i++) {
      const upId = custom.baseUrl ? "custom" : detectKeyUpstream(ordered[i]);
      const up = custom.baseUrl ? { name: "Custom", baseUrl: custom.baseUrl } : UPSTREAMS[upId === "unknown" ? target || "prov-gemini" : upId];
      const r = await relayChatCompletion({ baseUrl: up.baseUrl, apiKey: ordered[i], model: wanted, messages: openaiMessages, maxTokens: max_tokens, temperature });
      if (r.ok) {
        const latencyMs = Date.now() - startTime;
        const d = r.data || {};
        const choice = d.choices?.[0];
        const responseText = choice?.message?.content || "";
        const usage = d.usage || {};
        const promptTokens = usage.prompt_tokens ?? openaiMessages.reduce((acc: number, m: any) => acc + Math.ceil((m.content || "").length / 4), 0);
        const completionTokens = usage.completion_tokens ?? Math.ceil(responseText.length / 4);
        const served = custom.baseUrl ? "custom" : upId === "unknown" ? target || "prov-gemini" : upId;
        res.setHeader("X-Edge-Provider", "prov-universal");
        res.setHeader("X-Edge-Upstream", served);
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
            provider: up.name,
            // Canonical site provider ID — jaha ID dalni ho, yahi dalo:
            provider_id: "prov-universal",
            upstream_id: served,
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
});

// ---- Master key issue/status/revoke (local-dev parity with api/keys/*) ----
const MASTER_TTL_MS = 90 * 86400 * 1000;
const MAX_KEYS_PER_PROVIDER = 20;
const MAX_KEYS_TOTAL = 80;

function masterEncryptLocal(payload: any): string {
  const raw = deflateSync(Buffer.from(JSON.stringify(payload), "utf8"));
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", masterSecretBuf(), iv);
  const ct = Buffer.concat([c.update(raw), c.final()]);
  return MASTER_PREFIX + Buffer.concat([iv, ct, c.getAuthTag()]).toString("base64url");
}

function extractMasterLocal(req: any, body: any): string {
  const cands = [req.headers?.["x-master-key"], bearerTokenLocal(req), body?.masterKey];
  for (const c of cands) {
    if (typeof c === "string" && c.trim().startsWith(MASTER_PREFIX)) return c.trim();
  }
  return "";
}

async function kvSetExLocal(key: string, val: string, secs: number): Promise<boolean> {
  const url = process.env.KV_REST_API_URL;
  const tok = process.env.KV_REST_API_TOKEN;
  if (!url || !tok) return false;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2500);
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify(["SET", key, val, "EX", String(Math.max(60, Math.floor(secs)))]),
      signal: ctl.signal,
    });
    clearTimeout(t);
    const j: any = await r.json().catch(() => null);
    return j?.result === "OK";
  } catch {
    return false;
  }
}

app.post("/api/keys/issue", async (req, res) => {
  try {
    const body = req.body || {};
    const input = body.keys && typeof body.keys === "object" ? body.keys : null;
    if (!input) return res.status(400).json({ error: "Missing keys object" });
    const label = typeof body.label === "string" ? body.label.slice(0, 40) : "";
    const pools: Record<string, { k: string; g: string }[]> = {};
    let total = 0;
    for (const pid of Object.keys(input)) {
      if (!Array.isArray(input[pid])) return res.status(400).json({ error: `keys['${pid}'] array honi chahiye` });
      if (input[pid].length > MAX_KEYS_PER_PROVIDER) return res.status(400).json({ error: `${pid}: max ${MAX_KEYS_PER_PROVIDER} keys per provider` });
      const arr: { k: string; g: string }[] = [];
      for (const v of input[pid]) {
        const k = typeof v === "string" ? v.replace(/[\s'"`]+/g, "").trim() : typeof v?.k === "string" ? v.k.replace(/[\s'"`]+/g, "").trim() : "";
        if (k.length < 10) return res.status(400).json({ error: `${pid}: ek key bahut chhoti hai` });
        const rawG = typeof v?.g === "string" ? v.g.trim() : "";
        arr.push({ k, g: /.+@.+\..{2,}/.test(rawG) ? rawG : "" });
        total++;
      }
      if (arr.length > 0) pools[pid] = arr;
    }
    if (total === 0) return res.status(400).json({ error: "Kam se kam 1 key dalo" });
    if (total > MAX_KEYS_TOTAL) return res.status(400).json({ error: `Max ${MAX_KEYS_TOTAL} keys per master key.` });
    const mid = crypto.randomBytes(8).toString("hex");
    const exp = Date.now() + MASTER_TTL_MS;
    const masterKey = masterEncryptLocal({ v: 1, mid, exp, label, keys: pools });
    const providers: Record<string, { count: number; gmails: string[] }> = {};
    for (const pid of Object.keys(pools)) {
      providers[pid] = { count: pools[pid].length, gmails: [...new Set(pools[pid].map((e) => e.g).filter(Boolean))] };
    }
    return res.json({ masterKey, mid, label, expiresAt: exp, providers });
  } catch (err: any) {
    return res.status(500).json({ error: "Issue fail ho gaya" });
  }
});

app.post("/api/keys/status", async (req, res) => {
  try {
    const token = extractMasterLocal(req, req.body || {});
    if (!token) return res.status(401).json({ valid: false, error: "Master key (er1...) dalo." });
    let payload: any;
    try {
      payload = masterDecryptLocal(token);
    } catch {
      return res.status(401).json({ valid: false, error: "Master key invalid hai." });
    }
    const providers: Record<string, { count: number; gmails: string[] }> = {};
    for (const pid of Object.keys(payload.keys || {})) {
      const arr = Array.isArray(payload.keys[pid]) ? payload.keys[pid] : [];
      providers[pid] = {
        count: arr.length,
        gmails: [...new Set(arr.map((e: any) => (typeof e?.g === "string" ? e.g : "")).filter(Boolean))],
      };
    }
    return res.json({ valid: true, mid: payload.mid || "", label: payload.label || "", expiresAt: payload.exp, providers });
  } catch {
    return res.status(500).json({ valid: false, error: "Status fail ho gaya" });
  }
});

app.post("/api/keys/revoke", async (req, res) => {
  try {
    const token = extractMasterLocal(req, req.body || {});
    if (!token) return res.status(400).json({ revoked: false, error: "Master key (er1...) dalo." });
    let payload: any;
    try {
      payload = masterDecryptLocal(token);
    } catch {
      return res.status(400).json({ revoked: false, error: "Master key invalid hai." });
    }
    const mid = typeof payload?.mid === "string" ? payload.mid : "";
    if (!mid) return res.status(400).json({ revoked: false, error: "Master key invalid hai." });
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      return res.json({ revoked: false, mode: "local-only", message: "KV connected nahi hai — app se key hata do." });
    }
    const ttlSecs = Math.max(60, Math.floor(((payload.exp || Date.now()) - Date.now()) / 1000));
    const ok = await kvSetExLocal(`er:revoked:${mid}`, "1", ttlSecs);
    if (!ok) return res.status(502).json({ revoked: false, mode: "kv-error", error: "KV write fail — dobara try karo." });
    return res.json({ revoked: true, mode: "global", mid, message: "Master key turant cut." });
  } catch {
    return res.status(500).json({ revoked: false, error: "Revoke fail ho gaya" });
  }
});

// WebSocket Live API — wired only inside startServer() (long-lived servers).
// Never runs on serverless: no top-level side effects here.
async function initLiveSockets(httpServer: any) {
  const { WebSocketServer, WebSocket } = await import("ws") as any;
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request: any, socket: any, head: any) => {
    const url = new URL(request.url || "", `http://${request.headers.host}`);
    if (url.pathname === "/api/copilot/live") {
      wss.handleUpgrade(request, socket, head, (ws: any) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", async (clientWs: any, req: any) => {
    console.log("Client connected to Gemini Live voice stream");
    let session: any = null;

    try {
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      const clientKey = url.searchParams.get("key") || process.env.GEMINI_API_KEY;
      const activeProvider = url.searchParams.get("activeProvider") || "Cerebras / Groq";
      const policy = url.searchParams.get("policy") || "lowest-latency";
      const nodeCount = url.searchParams.get("nodeCount") || "12";
      const fallback = url.searchParams.get("fallback") || "Cerebras -> Groq -> Gemini";
      const ai = await getGenAIClient(clientKey || undefined);
      const { Modality } = await import("@google/genai");

    const liveInstruction = getRouterOperatorInstruction({
      activeProvider,
      policy,
      totalEndpoints: nodeCount,
      fallbackChain: [fallback],
      avgLatency: 18,
    });

    session = await ai.live.connect({
      model: "gemini-3.1-flash-live-preview",
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
        },
        systemInstruction: liveInstruction,
      },
      callbacks: {
        onmessage: (message: any) => {
          const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audio && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ audio }));
          }

          const textPart = message.serverContent?.modelTurn?.parts?.find((p: any) => p.text)?.text;
          if (textPart && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ text: textPart }));
          }

          if (message.serverContent?.interrupted && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ interrupted: true }));
          }
        },
      },
    });

    clientWs.on("message", (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.audio && session) {
          session.sendRealtimeInput({
            audio: { data: parsed.audio, mimeType: "audio/pcm;rate=16000" },
          });
        }
      } catch (err) {
        console.error("Error processing client live input:", err);
      }
    });

    clientWs.on("close", () => {
      console.log("Live client disconnected");
      if (session) {
        try {
          session.close();
        } catch (_) {}
      }
    });
  } catch (err: any) {
    console.error("Live API connection failed:", err);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ error: err.message || "Live API connection failed" }));
      clientWs.close();
    }
  }
  });
} // end initLiveSockets (long-lived servers only)

// Vite middleware / static asset serving (long-lived servers only)
async function startServer() {
  if (!server) {
    server = http.createServer(app);
    await initLiveSockets(server).catch((e) =>
      console.error("Live socket init failed:", e)
    );
  }
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Edge Router full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

// Auto-start only on real long-lived servers — never serverless, never tests.
if (process.env.NODE_ENV !== "test" && !IS_SERVERLESS) {
  startServer().catch((e) => console.error("Server start failed:", e));
}

export { app, server, startServer };
export default app;
