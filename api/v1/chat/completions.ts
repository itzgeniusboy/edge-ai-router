// SINGLE public gateway — FULLY SELF-CONTAINED (no cross-file imports).
// Key: per-user Gemini key via Authorization: Bearer <KEY> or x-gemini-key.
export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "Method not allowed", type: "invalid_request_error" } });
  }
  const startTime = Date.now();
  try {
    const headerKey = (req.headers["x-gemini-key"] as string) || "";
    const authHeader = (req.headers.authorization as string) || "";
    const clientKey = headerKey.trim() || authHeader.replace(/^Bearer\s+/i, "").trim();
    const { messages = [], model = "gemini-2.5-flash", max_tokens = 800, temperature = 0.7 } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: { message: "Invalid messages array", type: "invalid_request_error" } });
    }

    if (!clientKey) {
      return res.status(401).json({
        error: {
          message: "Login required: signup me apni Gemini key (AI Studio wali) dalo, fir usko Authorization: Bearer <TUMHARI_KEY> me bhejo. Endpoint single hai, key har user ki alag.",
          type: "authentication_error",
        },
      });
    }

    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({
      apiKey: clientKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });

    let targetModel = "gemini-2.5-flash";
    if (model.includes("pro") || model.includes("r1") || model.includes("gpt-4")) {
      targetModel = "gemini-3.1-pro-preview";
    }

    const contents = messages.map((m: any) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content || "" }],
    }));

    const aiResponse = await ai.models.generateContent({
      model: targetModel,
      contents,
      config: {
        maxOutputTokens: max_tokens,
        temperature,
      },
    });

    const latencyMs = Date.now() - startTime;
    const responseText = aiResponse.text || "";
    const promptTokens = messages.reduce((acc: number, m: any) => acc + Math.ceil((m.content || "").length / 4), 0);
    const completionTokens = Math.ceil(responseText.length / 4);

    res.setHeader("X-Edge-Latency-Ms", latencyMs.toString());
    res.setHeader("X-Edge-Router-Region", "global-anycast");

    return res.json({
      id: "chatcmpl-" + Math.random().toString(36).substring(2, 11),
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: targetModel,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: responseText,
          },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
      },
      edge_routing: {
        provider: "Edge AI Mesh",
        latency_ms: latencyMs,
        status: "200 OK",
      },
    });
  } catch (err: any) {
    console.error("Proxy completions error:", err);
    return res.status(500).json({
      error: {
        message: err.message || "Proxy completion failed",
        type: "internal_server_error",
      },
    });
  }
}
