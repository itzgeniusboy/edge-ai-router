// In-app Autonomous Copilot chat (per-user key via x-gemini-key / userApiKey).
import { getGenAIClient, getRouterOperatorInstruction } from "../_lib";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const { messages, currentRouterState, modelType, userApiKey } = req.body || {};
    const clientKey = (req.headers["x-gemini-key"] as string) || userApiKey;
    const ai = await getGenAIClient(clientKey);

    let model = "gemini-3.5-flash";
    if (modelType === "complex" || modelType === "reasoning") {
      model = "gemini-3.1-pro-preview";
    } else if (modelType === "fast" || modelType === "lite") {
      model = "gemini-3.1-flash-lite";
    }

    const systemInstruction = getRouterOperatorInstruction(currentRouterState);

    const contents = (messages || []).map((m: { role: string; content: string }) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    }));

    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const replyText = response.text || "Action executed.";
    res.json({
      text: replyText,
      modelUsed: model,
    });
  } catch (error: any) {
    console.error("Chat error:", error);
    res.status(500).json({
      error: error.message || "Failed to generate AI response",
    });
  }
}
