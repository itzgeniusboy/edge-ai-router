// Bisect probe: does importing @google/genai crash the function?
export default async function handler(_req: any, res: any) {
  try {
    const m = (await import("@google/genai")) as any;
    res.status(200).json({ ok: "genai", hasGoogleGenAI: !!m.GoogleGenAI });
  } catch (e: any) {
    res.status(500).json({ error: "genai-import-failed: " + (e?.message || String(e)) });
  }
}
