// Issue a UNIQUE master key embedding the user's provider pools — SELF-CONTAINED.
// POST { keys: { providerId: [{k,g} | "keystring", ...] }, label? }
// No auth needed: you only unlock keys you supply yourself (no privilege escalation).
// Caps: 20 keys/provider, 80 total (token header-size guard).
import crypto from "node:crypto";
import { deflateSync } from "node:zlib";

const MASTER_PREFIX = "er1.";
const MASTER_TTL_MS = 90 * 86400 * 1000;
const MAX_KEYS_PER_PROVIDER = 20;
const MAX_KEYS_TOTAL = 80;

function masterSecret(): Buffer {
  return crypto
    .createHash("sha256")
    .update(process.env.MASTER_KEY_SECRET || "er-dev-fallback-secret-v1-do-not-use-in-prod")
    .digest();
}

function masterEncrypt(payload: any): string {
  const raw = deflateSync(Buffer.from(JSON.stringify(payload), "utf8"));
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", masterSecret(), iv);
  const ct = Buffer.concat([c.update(raw), c.final()]);
  return MASTER_PREFIX + Buffer.concat([iv, ct, c.getAuthTag()]).toString("base64url");
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const body = req.body || {};
    const input = body.keys && typeof body.keys === "object" ? body.keys : null;
    if (!input) {
      return res.status(400).json({ error: "Missing keys object: { providerId: [{k, g}] }" });
    }
    const label = typeof body.label === "string" ? body.label.slice(0, 40) : "";
    const pools: Record<string, { k: string; g: string }[]> = {};
    let total = 0;
    for (const pid of Object.keys(input)) {
      if (!Array.isArray(input[pid])) {
        return res.status(400).json({ error: `keys['${pid}'] array honi chahiye` });
      }
      if (input[pid].length > MAX_KEYS_PER_PROVIDER) {
        return res.status(400).json({ error: `${pid}: max ${MAX_KEYS_PER_PROVIDER} keys per provider` });
      }
      const arr: { k: string; g: string }[] = [];
      for (const v of input[pid]) {
        const k = typeof v === "string" ? v.replace(/[\s'"`]+/g, "").trim() : typeof v?.k === "string" ? v.k.replace(/[\s'"`]+/g, "").trim() : "";
        if (k.length < 10) {
          return res.status(400).json({ error: `${pid}: ek key bahut chhoti hai — full key bhejo` });
        }
        const rawG = typeof v?.g === "string" ? v.g.trim() : "";
        const g = /.+@.+\..{2,}/.test(rawG) ? rawG : "";
        arr.push({ k, g });
        total++;
      }
      if (arr.length > 0) pools[pid] = arr;
    }
    if (total === 0) {
      return res.status(400).json({ error: "Kam se kam 1 key dalo" });
    }
    if (total > MAX_KEYS_TOTAL) {
      return res.status(400).json({ error: `Max ${MAX_KEYS_TOTAL} keys per master key (token size guard). Kam keys rakho ya 2nd master banao.` });
    }
    const mid = crypto.randomBytes(8).toString("hex");
    const exp = Date.now() + MASTER_TTL_MS;
    const masterKey = masterEncrypt({ v: 1, mid, exp, label, keys: pools });
    const providers: Record<string, { count: number; gmails: string[] }> = {};
    for (const pid of Object.keys(pools)) {
      providers[pid] = { count: pools[pid].length, gmails: [...new Set(pools[pid].map((e) => e.g).filter(Boolean))] };
    }
    return res.json({ masterKey, mid, label, expiresAt: exp, providers });
  } catch (err: any) {
    console.error("keys/issue error:", err?.message || err);
    return res.status(500).json({ error: "Issue fail ho gaya" });
  }
}
