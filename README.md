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

## Nexus se connect (koi bhi user, 2 minute)

> Note: Nexus config har user ki **apni machine pe local** hoti hai — GitHub se
> Nexus setup karne pe Edge Router option **khud nahi aayega**. Neeche steps se add karo.

1. Site kholo → signup/login → **KEYS** me provider keys dalo → **Export** tab →
   **GENERATE MY KEY** (apni UNIQUE `er1...` master key copy karo — har user ki alag).
2. Nexus me provider add karo — **Provider id:** `edge-router`, **API key:** tumhari master key.
   (Ye sirf credential store karta hai.)
3. `~/.config/nexus/nexus.jsonc` me ye block add karo (same `edge-router` id!):

```json
{
  "$schema": "https://nexus.ai/config.json",
  "provider": {
    "edge-router": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Edge Router (universal)",
      "options": {
        "baseURL": "https://edge-ai-router.vercel.app/api/v1"
      },
      "models": {
        "gemini-flash-latest": { "name": "Gemini Flash (Edge Router)" },
        "gemini-3.6-flash": { "name": "Gemini 3.6 Flash (Edge Router)" },
        "gemini-pro-latest": { "name": "Gemini Pro (Edge Router)" },
        "gemini-flash-lite-latest": { "name": "Gemini Flash Lite (Edge Router)" }
      }
    }
  }
}
```

4. Nexus **restart** karo → provider list me `edge-router` → switch-model me models.
5. **Sirf wahi models rakho jinki key hai:** Groq/OpenRouter/Cerebras ki key milte hi
   unke models upar `models` me add kar do (free wale — OpenRouter `pricing=0` check
   karke). Key hatao to uske models bhi hata do, nahi to dead dikhenge.

## ONE universal provider — official ID: `Edge Router`

Jaha bhi provider ID dalni pade (request body, client config, Copilot actions),
waha `Edge Router` dalo. Model naam se auto-route hota hai, ID dena optional hai.
(Purani IDs `prov-universal` / `prov-gemini` / `prov-groq` / `prov-openrouter` /
`prov-cerebras` bhi silent accept hoti hai — kuch tootega nahi.)

**Ek hi provider: Edge Router** — saare models, saari keys, auto-route.
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
