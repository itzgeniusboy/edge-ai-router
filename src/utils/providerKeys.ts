// Per-provider UNLIMITED API key pools (localStorage, zero-setup).
// Pool: er_api_keys_<providerId> = string[]. Legacy single er_api_key_<id> migrates once.

function poolKey(providerId: string): string {
  return `er_api_keys_${providerId}`;
}

export function getProviderKeys(providerId: string): string[] {
  try {
    const raw = localStorage.getItem(poolKey(providerId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((k) => typeof k === "string" && k.trim());
    }
    // One-time migration from legacy single-key slot
    const legacy =
      localStorage.getItem(`er_api_key_${providerId}`) ||
      (providerId === "prov-gemini" ? localStorage.getItem("er_gemini_key") : "");
    if (legacy && legacy.trim()) {
      const arr = [legacy.trim()];
      localStorage.setItem(poolKey(providerId), JSON.stringify(arr));
      return arr;
    }
    return [];
  } catch {
    return [];
  }
}

export function getAllProviderKeys(providerIds: string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  providerIds.forEach((id) => {
    out[id] = getProviderKeys(id);
  });
  return out;
}

export function addProviderKey(providerId: string, key: string): { ok: boolean; error?: string } {
  const k = (key || "").replace(/[\s'"`]+/g, "").trim();
  if (k.length < 10) return { ok: false, error: "Key bahut chhoti hai — full key paste karo" };
  const pool = getProviderKeys(providerId);
  if (pool.includes(k)) return { ok: false, error: "Ye key already added hai" };
  pool.push(k);
  try {
    localStorage.setItem(poolKey(providerId), JSON.stringify(pool));
    if (providerId === "prov-gemini") localStorage.setItem("er_gemini_key", pool[0]);
  } catch {
    return { ok: false, error: "Save fail ho gaya" };
  }
  return { ok: true };
}

export function removeProviderKey(providerId: string, index: number): void {
  try {
    const pool = getProviderKeys(providerId);
    pool.splice(index, 1);
    localStorage.setItem(poolKey(providerId), JSON.stringify(pool));
    if (providerId === "prov-gemini") localStorage.setItem("er_gemini_key", pool[0] || "");
  } catch { /* ignore */ }
}

export function maskKey(key: string): string {
  if (!key) return "(khali)";
  if (key.length <= 12) return "••••••••";
  return `${key.slice(0, 8)}•••• (${key.length} chars)`;
}
