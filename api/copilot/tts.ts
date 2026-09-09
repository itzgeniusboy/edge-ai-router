// In-app Copilot TTS (per-user key via x-gemini-key / userApiKey).
import { getGenAIClient } from "../_lib";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const { text, userApiKey } = req.body || {};
    const clientKey = (req.headers["x-gemini-key"] as string) || userApiKey;
    const ai = await getGenAIClient(clientKey);
    const { Modality } = await import("@google/genai");

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: (text || "").slice(0, 500) }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Kore" },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      return res.status(404).json({ error: "No audio generated" });
    }

    res.json({ audio: base64Audio });
  } catch (error: any) {
    console.error("TTS error:", error);
    res.status(500).json({ error: error.message || "TTS generation failed" });
  }
}
