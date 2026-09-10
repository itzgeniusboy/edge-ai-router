// Master key status — SELF-CONTAINED. Keys NEVER returned (counts + gmails only).
// Master key via Authorization Bearer / x-master-key header / body.masterKey.
import crypto from "node:crypto";
import { inflateSync } from "node:zlib";

const MASTER_PREFIX = "er1.";

function masterSecret(): Buffer {
  return crypto
    .createHash("sha256")
    .update(process.env.MASTER_KEY_SECRET || "er-dev-fallback-secret-v1-do-not-use-in-prod")
    .digest();
}

export default async function handler(req: any, res: any) {
  try {
    const cands = [
      req.headers?.["x-master-key"],
      (req.headers?.authorization || "").replace(/^Bearer\s+/i, ""),
      req.body?.masterKey,
    ];
    const token = cands.find((c) => typeof c === "string" && c.trim().startsWith(MASTER_PREFIX))?.trim() || "";
    if (!token) {
      return res.status(401).json({ valid: false, error: "Master key (er1...) dalo." });
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
    } catch {
      return res.status(401).json({ valid: false, error: "Master key invalid hai (tutli-phutli ya galat secret)." });
    }
    if (!payload || payload.v !== 1 || typeof payload.exp !== "number" || typeof payload.keys !== "object") {
      return res.status(401).json({ valid: false, error: "Master key invalid hai." });
    }
    if (payload.exp <= Date.now()) {
      return res.status(401).json({ valid: false, expired: true, error: "Master key expire ho gayi — Regenerate karo." });
    }
    const providers: Record<string, { count: number; gmails: string[] }> = {};
    for (const pid of Object.keys(payload.keys || {})) {
      const arr = Array.isArray(payload.keys[pid]) ? payload.keys[pid] : [];
      providers[pid] = {
        count: arr.length,
        gmails: [...new Set(arr.map((e: any) => (typeof e?.g === "string" ? e.g : "")).filter(Boolean))],
      };
    }
    return res.json({
      valid: true,
      mid: payload.mid || "",
      label: payload.label || "",
      expiresAt: payload.exp,
      providers,
    });
  } catch (err: any) {
    console.error("keys/status error:", err?.message || err);
    return res.status(500).json({ valid: false, error: "Status fail ho gaya" });
  }
}
