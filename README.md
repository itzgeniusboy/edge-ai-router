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

## ONE universal provider — official ID: `prov-universal`

Jaha bhi provider ID dalni pade (request body, client config, Copilot actions),
waha `prov-universal` dalo. Model naam se auto-route hota hai, ID dena optional hai.

**Ek hi provider: Edge Router (`prov-universal`)** — saare models, saari keys, auto-route.
Sirf **model naam** bhejo, server khud sahi upstream pakadta hai:

| Model example | Jaata hai |
|---|---|
| `gemini-flash-latest`, `gemini-3.6-flash` | Google Gemini (key: `AIza...`/`AQ...` — aistudio.google.com) |
| `llama-3.3-70b-versatile`, `mixtral-8x7b-32768` | Groq (key: `gsk_...` — console.groq.com) |
| `openai/gpt-4o-mini`, `anthropic/...` | OpenRouter (key: `sk-or-...` — openrouter.ai) |
| `llama-3.3-70b`, `llama3.1-8b` | Cerebras (key: `csk-...` — cloud.cerebras.ai) |

Site me **KEYS** button → ek hi list me unlimited keys dalo (prefix se auto-badge + Gmail tag).
429/quota/auth-fail pe automatic next key try hoti hai (rotation).
401/403 wali key auto-quarantine (Gmail tag notice samet).
Custom `baseUrl` public `https` hona chahiye (private/loopback/link-local block — SSRF guard).

## Single public endpoint

```
POST {site}/api/v1/chat/completions
Authorization: Bearer <master-key-ya-direct-key>
Content-Type: application/json

{
  "model": "llama-3.3-70b-versatile",
  "messages": [{ "role": "user", "content": "hi" }],
  "max_tokens": 800,
  "temperature": 0.7
}
```

`providerId` dene ki zaroorat nahi (purani IDs silent accept — kuch tootega nahi).
Response OpenAI-shape + `edge_routing` (serving upstream + `key_prefix`) + headers
(`X-Edge-Upstream`, `X-Edge-Key-Index`, `X-Edge-Latency-Ms`).

Baaki routes: `GET /api/health`, `GET /api/ping`,
`POST /api/copilot/chat`, `POST /api/copilot/tts`,
`POST /api/router/inference` (sab JSON; crash page kabhi nahi).

## Unique master key (link + 1 key = sab providers)

Export tab → **Generate** dabao: tumhari saari keys ek encrypted
`er1...` master key me lock ho jayengi (90 din valid, max 80 keys).
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

## Live catalog (autonomous, free-only)

- `POST /api/catalog/sync` 4 providers ke live `/models` se list kheenchta hai
  (login pe + har 6h auto + Tester me SYNC button). Added/removed ka diff 🔔 aata hai.
- **Sirf FREE models:** OpenRouter `pricing=0/0` filter (paid bahar); Gemini/Groq/Cerebras
  free-tier keys pe chalne wale. Switcher default **Active** (key-hai + live + failed-nahi),
  search + upstream groups + retired section ke saath.
- Model 404 hua to auto-hide + notice; wapas aaya to auto-show.
- `GET /api/v1/models` Bearer key pe har model pe `available` flag deta hai.

## Architecture notes

- `api/*.ts` = Vercel serverless functions. **RULE: koi relative `.ts` cross-import nahi**
  (is setup pe bundler toot ta hai — har file self-contained + npm imports only).
- `server.ts` = local-dev full server (Express + WS Live). Vercel pe use nahi hota.
- Copilot system prompt 2 jagah hai (`api/copilot/chat.ts` + `server.ts`) — dono sync rakho.
- Auth: browser-localStorage users (SHA-256) — zero-setup trade-off, multi-device sync nahi.
- Copilot replies short-by-design (`maxOutputTokens: 500`); detail maangne pe lambi.
- Mic Live Voice sirf local server pe (Vercel serverless me WebSocket nahi).
