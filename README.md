# Edge AI Router — Multi-Provider Gateway

1 endpoint, har provider ki apni keys. Signup → keys → pura system live.

## Chalane ka tarika (local)

```bash
npm install
node ./node_modules/vite/bin/vite.js build
NODE_ENV=production PORT=3000 node dist/server.cjs
# kholo: http://127.0.0.1:3000
```

Dev: `node ./node_modules/tsx/dist/cli.mjs server.ts` (Note: Termux me `npm run` scripts fail hote
hai `/usr/bin/env` missing ki wajah se — `node ./node_modules/...` full path use karo.)

## Deploy (Vercel)

GitHub push → Vercel auto-deploy. Koi env/DB setup nahi chahiye.
`vercel.json` me `/api/*` serverless functions + baaki static SPA hai.

## Providers + Keys (unlimited keys per provider)

Catalog (OpenAI-compatible):

| Provider | Base URL | Key kaha se |
|---|---|---|
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | aistudio.google.com → Get API Key |
| Groq | `https://api.groq.com/openai/v1` | console.groq.com → API Keys |
| OpenRouter | `https://openrouter.ai/api/v1` | openrouter.ai → Keys |
| Cerebras | `https://api.cerebras.ai/v1` | cloud.cerebras.ai → API Keys |

Site me **KEYS** button → har provider me unlimited keys add karo.
429/quota/auth-fail pe automatic next key try hoti hai (rotation).
Custom provider: `baseUrl` public `https` hona chahiye (private/loopback/link-local block hai — SSRF guard).

## Single public endpoint

```
POST {site}/api/v1/chat/completions
Authorization: Bearer <us-provider-ki-key>
Content-Type: application/json

{
  "providerId": "prov-gemini | prov-groq | prov-openrouter | prov-cerebras",
  "model": "gemini-flash-latest (default) ya provider-native model",
  "messages": [{ "role": "user", "content": "hi" }],
  "max_tokens": 800,
  "temperature": 0.7,
  "apiKeys": ["<key1>", "<key2>"]   // optional: rotation pool
}
```

Response OpenAI-shape + `edge_routing` + headers
(`X-Edge-Provider`, `X-Edge-Key-Index`, `X-Edge-Latency-Ms`).

Baaki routes: `GET /api/health`, `GET /api/ping`,
`POST /api/copilot/chat`, `POST /api/copilot/tts`,
`POST /api/router/inference` (sab JSON; crash page kabhi nahi).

## Unique master key (link + 1 key = sab providers)

Export tab → **Generate** dabao: tumhare saare provider pools ek encrypted
`er1...` master key me lock ho jayenge (90 din valid, per-provider max 20 keys).
Bahar ke tools me **site link + master key** dalo — background me pools se relay hoga.
Raw provider keys kabhi share mat karo.

- **Regenerate:** anytime (nayi expiry). Pool badle to stale warning aayega.
- **Delete:** app se turant + server-side revoke. Global instant-revoke ke liye
  Vercel KV connect karo (Storage → Create → KV → project connect;
  `KV_REST_API_URL` + `KV_REST_API_TOKEN` auto-inject honge). Bina KV ke
  local-delete + expiry kaam karega.
- **Dead keys:** 401/403 wali key auto-quarantine (Gmail tag samet notice),
  KEYS me Revive ya replace karo.
- **Secret:** `MASTER_KEY_SECRET` env lagao production me, nahi to built-in
  fallback (kaam karega, determined attacker ke liye kamzor — README me saf).
- `POST /api/keys/issue` (mint), `POST /api/keys/status` (counts+gmails, keys never),
  `POST /api/keys/revoke` (blocklist).

## Architecture notes

- `api/*.ts` = Vercel serverless functions. **RULE: koi relative `.ts` cross-import nahi**
  (is setup pe bundler toot ta hai — har file self-contained + npm imports only).
- `server.ts` = local-dev full server (Express + WS Live). Vercel pe use nahi hota.
- Copilot system prompt 2 jagah hai (`api/copilot/chat.ts` + `server.ts`) — dono sync rakho.
- Auth: browser-localStorage users (SHA-256) — zero-setup trade-off, multi-device sync nahi.
- Copilot replies short-by-design (`maxOutputTokens: 500`); detail maangne pe lambi.
- Mic Live Voice sirf local server pe (Vercel serverless me WebSocket nahi).
