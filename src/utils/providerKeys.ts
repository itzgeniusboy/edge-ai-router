// Per-provider UNLIMITED API key pools (localStorage, zero-setup).
// Entry: { k: key, g: gmail tag, s: 'active'|'dead', a: addedAt }.
// Legacy string[] pools and single er_api_key_<id> migrate automatically.
// Cap: 20 keys per provider (master token size guard).

export interface KeyEntry {
  k: string;
  g: string;
  s: "active" | "dead";
  a: number;
}

export const MAX_KEYS_PER_PROVIDER = 20;

function poolKey(providerId: string): string {
  return `er_api_keys_${providerId}`;
}

function normEntry(v: any): KeyEntry | null {
  if (typeof v === "string" && v.trim()) {
    return { k: v.trim(), g: "", s: "active", a: Date.now() };
  }
  if (v && typeof v.k === "string" && v.k.trim()) {
    return {
      k: v.k.trim(),
      g: typeof v.g === "string" ? v.g.trim() : "",
      s: v.s === "dead" ? "dead" : "active",
      a: typeof v.a === "number" ? v.a : Date.now(),
    };
  }
  return null;
}

export function getProviderKeyEntries(providerId: string): KeyEntry[] {
  try {
    const raw = localStorage.getItem(poolKey(providerId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const out: KeyEntry[] = [];
        parsed.forEach((v) => {
          const e = normEntry(v);
          if (e) out.push(e);
        });
        return out;
      }
    }
    // One-time migration from legacy single-key slot
    const legacy =
      localStorage.getItem(`er_api_key_${providerId}`) ||
      (providerId === "prov-gemini" ? localStorage.getItem("er_gemini_key") : "");
    if (legacy && legacy.trim()) {
      const arr: KeyEntry[] = [{ k: legacy.trim(), g: "", s: "active", a: Date.now() }];
      localStorage.setItem(poolKey(providerId), JSON.stringify(arr));
      return arr;
    }
    return [];
  } catch {
    return [];
  }
}

function saveEntries(providerId: string, entries: KeyEntry[]) {
  localStorage.setItem(poolKey(providerId), JSON.stringify(entries));
  if (providerId === "prov-gemini") {
    const first = entries.find((e) => e.s === "active") || entries[0];
    localStorage.setItem("er_gemini_key", first ? first.k : "");
  }
}

// All key strings in stable pool order (dead included — backend tries + reports,
// which enables self-heal if a dead key works again).
export function getProviderKeys(providerId: string): string[] {
  return getProviderKeyEntries(providerId).map((e) => e.k);
}

export function getAllProviderKeys(providerIds: string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  providerIds.forEach((id) => {
    out[id] = getProviderKeys(id);
  });
  return out;
}

export function isValidGmail(g: string): boolean {
  return /.+@.+\..{2,}/.test((g || "").trim());
}

export function addProviderKey(providerId: string, key: string, gmail = ""): { ok: boolean; error?: string } {
  const k = (key || "").replace(/[\s'"`]+/g, "").trim();
  if (k.length < 10) return { ok: false, error: "Key bahut chhoti hai — full key paste karo" };
  const entries = getProviderKeyEntries(providerId);
  if (entries.length >= MAX_KEYS_PER_PROVIDER) {
    return { ok: false, error: `Max ${MAX_KEYS_PER_PROVIDER} keys per provider` };
  }
  if (entries.some((e) => e.k === k)) return { ok: false, error: "Ye key already added hai" };
  const g = (gmail || "").trim();
  entries.push({ k, g: isValidGmail(g) ? g : "", s: "active", a: Date.now() });
  try {
    saveEntries(providerId, entries);
  } catch {
    return { ok: false, error: "Save fail ho gaya" };
  }
  return { ok: true };
}

export function removeProviderKey(providerId: string, index: number): void {
  try {
    const entries = getProviderKeyEntries(providerId);
    entries.splice(index, 1);
    saveEntries(providerId, entries);
  } catch { /* ignore */ }
}

export function setKeyStatus(providerId: string, index: number, status: "active" | "dead"): boolean {
  try {
    const entries = getProviderKeyEntries(providerId);
    if (!entries[index] || entries[index].s === status) return false;
    entries[index] = { ...entries[index], s: status };
    saveEntries(providerId, entries);
    return true;
  } catch {
    return false;
  }
}

// Mark dead by upstream-reported key prefixes (order-independent, robust to pool edits).
// Returns newly-dead entries (for notifications with Gmail tags).
export function markDeadByPrefixes(providerId: string, prefixes: string[]): KeyEntry[] {
  const fresh: KeyEntry[] = [];
  try {
    const entries = getProviderKeyEntries(providerId);
    let changed = false;
    prefixes.forEach((p) => {
      const idx = entries.findIndex((e) => e.s === "active" && e.k.startsWith(p));
      if (idx !== -1) {
        entries[idx] = { ...entries[idx], s: "dead" };
        fresh.push(entries[idx]);
        changed = true;
      }
    });
    if (changed) saveEntries(providerId, entries);
  } catch { /* ignore */ }
  return fresh;
}

export function reviveProviderKey(providerId: string, index: number): boolean {
  return setKeyStatus(providerId, index, "active");
}

export function maskKey(key: string): string {
  if (!key) return "(khali)";
  if (key.length <= 12) return "••••••••";
  return `${key.slice(0, 8)}•••• (${key.length} chars)`;
}

// Canonical snapshot string of pools (for master-key staleness compare).
export function poolsSnapshot(providerIds: string[]): string {
  try {
    const snap: Record<string, string[]> = {};
    providerIds.forEach((id) => {
      snap[id] = getProviderKeys(id);
    });
    return JSON.stringify(snap);
  } catch {
    return "";
  }
}
