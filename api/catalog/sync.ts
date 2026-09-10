// Live provider catalog sync — FULLY SELF-CONTAINED (no cross-file imports).
// POST { keys?: { gemini?: string[], groq?: string[], openrouter?: string[], cerebras?: string[] } }
// Fans out to each provider's /models (8s timeout each). One provider failing
// never fails the whole sync. Keys are NEVER logged or returned.
const FETCH_TIMEOUT_MS = 8000;
const MAX_MODELS_PER_UPSTREAM = 150;

function firstKey(v: any): string {
  if (Array.isArray(v)) {
    const f = v.find((k) => typeof k === "string" && k.trim());
    return f ? f.trim() : "";
  }
  return typeof v === "string" && v.trim() ? v.trim() : "";
}

async function fetchJson(url: string, headers: Record<string, string>): Promise<any> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, { headers, signal: ctl.signal });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      throw new Error(`HTTP ${r.status}${txt ? `: ${txt.slice(0, 120)}` : ""}`);
    }
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

export interface SyncedModel {
  id: string;
  name: string;
  upstream: string;
  free?: boolean;
}

async function syncGemini(key: string): Promise<{ ok: boolean; models: SyncedModel[]; error?: string }> {
  if (!key) return { ok: false, models: [], error: "no-key" };
  try {
    const j: any = await fetchJson(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=100`,
      {}
    );
    const arr = Array.isArray(j?.models) ? j.models : [];
    const models: SyncedModel[] = [];
    for (const m of arr) {
      const name = typeof m?.name === "string" ? m.name.replace(/^models\//, "") : "";
      const methods: string[] = Array.isArray(m?.supportedGenerationMethods) ? m.supportedGenerationMethods : [];
      if (!name || !methods.includes("generateContent")) continue;
      if (/embedding|aqa|transcribe|tts|image|video|audio|live|bidi|robotics|lyria|veo|computer-use|deep-research|antigravity/i.test(name)) continue;
      models.push({ id: name, name, upstream: "prov-gemini" });
      if (models.length >= MAX_MODELS_PER_UPSTREAM) break;
    }
    return { ok: true, models };
  } catch (e: any) {
    return { ok: false, models: [], error: e?.name === "AbortError" ? "timeout" : e?.message || "fetch-failed" };
  }
}

async function syncGroq(key: string): Promise<{ ok: boolean; models: SyncedModel[]; error?: string }> {
  if (!key) return { ok: false, models: [], error: "no-key" };
  try {
    const j: any = await fetchJson("https://api.groq.com/openai/v1/models", { Authorization: `Bearer ${key}` });
    const arr = Array.isArray(j?.data) ? j.data : [];
    const models: SyncedModel[] = [];
    for (const m of arr) {
      const id = typeof m?.id === "string" ? m.id : typeof m === "string" ? m : "";
      if (!id || /whisper|embedding|tts|guard/i.test(id)) continue;
      models.push({ id, name: id, upstream: "prov-groq" });
      if (models.length >= MAX_MODELS_PER_UPSTREAM) break;
    }
    return { ok: true, models };
  } catch (e: any) {
    return { ok: false, models: [], error: e?.name === "AbortError" ? "timeout" : e?.message || "fetch-failed" };
  }
}

async function syncOpenRouter(): Promise<{ ok: boolean; models: SyncedModel[]; error?: string }> {
  try {
    const j: any = await fetchJson("https://openrouter.ai/api/v1/models", {});
    const arr = Array.isArray(j?.data) ? j.data : [];
    const models: SyncedModel[] = [];
    for (const m of arr) {
      const id = typeof m?.id === "string" ? m.id : "";
      if (!id) continue;
      const outMods: string[] = Array.isArray(m?.architecture?.output_modalities) ? m.architecture.output_modalities : [];
      // Sirf text-out chat models (embedding/image/audio bahar)
      if (outMods.length > 0 && !outMods.includes("text")) continue;
      if (/embedding|audio|video|image|tts|whisper|lyria/i.test(id)) continue;
      // FREE-ONLY: pricing present hai to prompt+completion dono 0 hone chahiye (paid bahar)
      const pr = m?.pricing;
      if (pr && typeof pr === "object") {
        const pp = Number((pr as any).prompt);
        const pc = Number((pr as any).completion);
        if (!Number.isFinite(pp) || !Number.isFinite(pc) || pp !== 0 || pc !== 0) continue;
      }
      models.push({ id, name: typeof m?.name === "string" && m.name ? m.name : id, upstream: "prov-openrouter", free: true });
      if (models.length >= MAX_MODELS_PER_UPSTREAM) break;
    }
    return { ok: true, models };
  } catch (e: any) {
    return { ok: false, models: [], error: e?.name === "AbortError" ? "timeout" : e?.message || "fetch-failed" };
  }
}

async function syncCerebras(key: string): Promise<{ ok: boolean; models: SyncedModel[]; error?: string }> {
  if (!key) return { ok: false, models: [], error: "no-key" };
  try {
    const j: any = await fetchJson("https://api.cerebras.ai/v1/models", { Authorization: `Bearer ${key}` });
    const arr = Array.isArray(j?.data) ? j.data : Array.isArray(j?.models) ? j.models : [];
    if (!Array.isArray(arr) || arr.length === 0) {
      return { ok: false, models: [], error: "unknown-shape" };
    }
    const models: SyncedModel[] = [];
    for (const m of arr) {
      const id = typeof m?.id === "string" ? m.id : typeof m?.name === "string" ? m.name : typeof m === "string" ? m : "";
      if (!id) continue;
      models.push({ id, name: id, upstream: "prov-cerebras" });
      if (models.length >= MAX_MODELS_PER_UPSTREAM) break;
    }
    return { ok: true, models };
  } catch (e: any) {
    return { ok: false, models: [], error: e?.name === "AbortError" ? "timeout" : e?.message || "fetch-failed" };
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const body = req.body || {};
    const ink = body.keys && typeof body.keys === "object" ? body.keys : {};
    const [gemini, groq, openrouter, cerebras] = await Promise.all([
      syncGemini(firstKey(ink.gemini)),
      syncGroq(firstKey(ink.groq)),
      syncOpenRouter(),
      syncCerebras(firstKey(ink.cerebras)),
    ]);
    const models: SyncedModel[] = [...gemini.models, ...groq.models, ...openrouter.models, ...cerebras.models];
    const status = (r: { ok: boolean; models: SyncedModel[]; error?: string }) =>
      r.ok ? { ok: true as const, count: r.models.length } : { ok: false as const, count: 0, error: r.error || "failed" };
    return res.json({
      syncedAt: Date.now(),
      models,
      perUpstream: {
        "prov-gemini": status(gemini),
        "prov-groq": status(groq),
        "prov-openrouter": status(openrouter),
        "prov-cerebras": status(cerebras),
      },
    });
  } catch (err: any) {
    console.error("catalog/sync error:", err?.message || err);
    return res.status(500).json({ error: "Sync fail ho gaya" });
  }
}
