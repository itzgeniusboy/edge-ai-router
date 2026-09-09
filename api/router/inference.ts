// In-app Tester inference (per-user key; 401 when missing — no fake success).
import { getGenAIClient } from "../_lib";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const startTime = Date.now();
  try {
    const { prompt, model = "gemini-2.5-flash", clientApiKey } = req.body || {};
    const clientKey = (req.headers["x-gemini-key"] as string) || clientApiKey || process.env.GEMINI_API_KEY;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing prompt parameter" });
    }
    if (!clientKey) {
      return res.status(401).json({ error: "Login required: pehle signup me Gemini key dalo." });
    }

    const ai = await getGenAIClient(clientKey);
    let targetModel = "gemini-2.5-flash";
    if (model.includes("pro") || model.includes("r1") || model.includes("reasoner")) {
      targetModel = "gemini-3.1-pro-preview";
    } else if (model.includes("lite") || model.includes("instant")) {
      targetModel = "gemini-3.1-flash-lite";
    }

    const aiResponse = await ai.models.generateContent({
      model: targetModel,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        maxOutputTokens: 600,
        temperature: 0.7,
      },
    });

    const latencyMs = Date.now() - startTime;
    const text = aiResponse.text || "OK";
    const tokens = Math.max(15, Math.ceil(text.length / 4) + Math.ceil(prompt.length / 4));

    return res.json({
      status: "ok",
      isLive: true,
      response: text,
      modelUsed: targetModel,
      latencyMs,
      tokens,
    });
  } catch (err: any) {
    console.error("Inference route error:", err);
    const latencyMs = Date.now() - startTime;
    return res.status(500).json({
      error: err.message || "Inference failed",
      latencyMs,
    });
  }
}
