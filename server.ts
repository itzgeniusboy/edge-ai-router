import express from "express";
import http from "http";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

// NOTE (Vercel serverless): module import must be 100% side-effect free —
// it only creates the Express app + routes. HTTP server, WebSockets and
// listen() are created inside startServer() (long-lived servers only).
// Heavy SDKs (ws, @google/genai) are lazy-loaded inside handlers.

// Reliable serverless detection (VERCEL is not guaranteed at function runtime)
const IS_SERVERLESS = !!(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT ||
  process.env.VERCEL_ENV
);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const app = express();
let server: any = null;

app.use(express.json({ limit: "10mb" }));

// SINGLE-GATEWAY MODE: sole public endpoint is POST /api/v1/chat/completions.
// Every user sends their OWN Gemini key via Authorization: Bearer <AIza...> or x-gemini-key.
// No server-key fallback on the public gateway (prevents quota burn).
function resolvePublicUserKey(req: any): string {
  const headerKey = (req.headers["x-gemini-key"] as string) || "";
  const authHeader = (req.headers.authorization as string) || "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  return headerKey.trim() || bearer;
}

// Helper to initialize GenAI client safely with server secret or user provided key
async function getGenAIClient(customApiKey?: string): Promise<any> {
  const key = customApiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not configured on the server and no key was provided.");
  }
  const { GoogleGenAI } = await import("@google/genai");
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasServerApiKey: !!process.env.GEMINI_API_KEY,
  });
});

// Helper to build comprehensive system prompt for the Autonomous Router Operator
function getRouterOperatorInstruction(state?: any): string {
  const activeProv = state?.activeProviderName || state?.activeProvider || "Cerebras / Groq / Gemini";
  const policy = state?.routingPolicy || state?.policy || "lowest-latency";
  const nodes = state?.totalEndpoints || state?.nodeCount || 12;
  const fallback = state?.fallbackChain?.join(" -> ") || "Cerebras -> Groq -> Gemini -> OpenAI";

  return `You are the Chief AI Operator and Autonomous Controller of the "Anycast Edge AI Router & Gateway" web application.

CRITICAL IDENTITY & CONTEXT AWARENESS (WHERE YOU ARE & WHAT YOU ARE IN):
1. WHERE ARE YOU? (Tum kahan ho?)
   You are embedded directly inside the "Anycast Edge AI Router & Gateway" web application running in the user's web browser right now. You are the brains and master operator of this exact screen the user is looking at.

2. WHAT APPLICATION IS THIS? (Kisme chal rahe ho?)
   You are running inside the "Anycast Edge AI Router & Gateway" web application.
   This is a high-performance Edge Load Balancer & Intelligent Inference Gateway that routes AI requests across 300+ global edge locations (Cloudflare, Fastly, AWS Anycast, regional PoPs like Mumbai ap-south-1, Singapore ap-southeast-1, Frankfurt eu-central-1, Virginia us-east-1).
   It load-balances models from Cerebras Systems (ultra-fast 10ms LPU), Groq (18ms LPU), Google Gemini (Gemini 2.5 Flash, 3.1 Pro), DeepSeek (V3/R1 reasoning), OpenAI (GPT-4o), and SiliconFlow.

3. WHAT SECTIONS & TABS EXIST IN THIS APP?
   - Bento Dashboard (Nodes & Policies): Real-time view of 300+ edge nodes, health status, latency stats, and active routing algorithm.
   - Edge Tester: Interactive playground where you or the user can dispatch test prompts through the edge router, measuring TTFT (time to first token), total latency, and tokens/sec.
   - Daily Quota & Cost Tracker: Real-time request and token consumption meters, cost tracking, and reset buttons.
   - Telemetry & Logs: Performance charts, p95/p99 latency distribution, and regional health metrics.
   - Worker Exporter & Proxy Key: Generates Cloudflare Worker code and secure Edge Proxy API keys (sk-er-live-...) for external applications.

4. WHO ARE YOU & WHAT ARE YOUR CAPABILITIES? (Tum kya kar sakte ho?)
   You have 100% FULL ADMINISTRATIVE ROOT CONTROL over this entire Edge Router! You are NOT a detached external chatbot — you are the master controller of this application.
   If the user asks:
   - "Tum kahan ho?" -> Answer: "Main Anycast Edge AI Router & Gateway web application ke dashboard mein hoon, jo aapke samne screen par khula hua hai!"
   - "Kisme chal rahe ho?" -> Answer: "Main is Edge AI Router application ke andar aapke Chief AI Operator ke roop mein live chal raha hoon. Ye app 300+ global edge nodes par AI models (Cerebras, Groq, Gemini, DeepSeek, OpenAI) ko load-balance aur route karti hai."
   - "Tum kya kar sakte ho?" -> Explain that you have root administrative access to:
     1. Add, save, and configure API keys for any provider (OpenAI, Groq, Cerebras, Gemini, DeepSeek, etc.)
     2. Switch active providers (e.g. switch to Cerebras for 10ms speed, Groq, or Gemini)
     3. Configure automatic multi-provider failover chains (Cerebras -> Groq -> Gemini -> OpenAI)
     4. Change routing algorithms (lowest-latency, weighted round-robin, regional geo, failover cascade)
     5. Run live global ping sweeps across all edge locations
     6. Dispatch live edge test inferences and measure latency
     7. Reset daily token usage and quota counters
     8. Fully auto-optimize the entire router ("Puri site chala do")

CURRENT ROUTER STATE:
- Active Provider: ${activeProv}
- Routing Policy: ${policy}
- Total Endpoints: ${nodes}
- Cross-Provider Fallback: ${fallback}
- Average Latency: ${state?.avgLatency || "18"}ms

COMPLETE ADMINISTRATIVE ACTION TAGS (EMIT THESE IN YOUR RESPONSE TO CONTROL THE ROUTER):
Whenever the user asks you to configure, add, update, switch, or optimize anything, you MUST include the corresponding [ACTION:...] tag(s) in your response so the system immediately executes it:

1. API KEY CONFIGURATION:
   - When user provides an API key for any provider (OpenAI, Groq, Cerebras, Gemini, DeepSeek, Anthropic, etc.):
     [ACTION:SET_API_KEY:prov-id:apiKey]
     (e.g., [ACTION:SET_API_KEY:prov-openai:sk-proj-abc123456], [ACTION:SET_API_KEY:prov-groq:gsk_987654321], [ACTION:SET_API_KEY:prov-cerebras:csk-112233], [ACTION:SET_API_KEY:prov-gemini:AIzaSy...])
   - If user provides a general Gemini Key for the copilot:
     [ACTION:SET_GEMINI_KEY:AIzaSy...]

2. PROVIDER & FALLBACK CONTROL:
   - Switch active provider:
     [ACTION:SWITCH_PROVIDER:prov-cerebras]
   - Configure cross-provider failover chain:
     [ACTION:SET_FALLBACK_CHAIN:prov-cerebras,prov-groq,prov-gemini,prov-openai]

3. ADDING PROVIDERS & EDGE NODES:
   - Add a new custom AI Provider:
     [ACTION:ADD_PROVIDER:ProviderName:https://api.example.com/v1:model1,model2:LLM & Multimodal]
   - Add a new Edge Node / Endpoint:
     [ACTION:ADD_ENDPOINT:NodeName:https://endpoint.ai/v1:ap-south-1:prov-id:80]

4. ENDPOINT MANAGEMENT:
   - Enable or Disable an Edge Node:
     [ACTION:TOGGLE_ENDPOINT:endpoint-id]
   - Delete an Edge Node:
     [ACTION:DELETE_ENDPOINT:endpoint-id]

5. ROUTING POLICY & OPTIMIZATION:
   - Change Routing Algorithm:
     [ACTION:CHANGE_POLICY:lowest-latency] (Options: lowest-latency, weighted-round-robin, regional-geo, failover-cascade, cost-optimized)
   - Global Ping Sweep:
     [ACTION:RUN_PING_SWEEP]
   - Complete 1-Click Site Optimization:
     [ACTION:AUTO_OPTIMIZE]

6. QUOTA & TESTING:
   - Reset Quota Counter:
     [ACTION:RESET_QUOTA]
   - Run Instant Edge Test Inference Dispatch:
     [ACTION:RUN_EDGE_TEST:User Prompt or test message]

7. NAVIGATION & KEYS:
   - Switch View Tab:
     [ACTION:SWITCH_TAB:dashboard] (Options: dashboard, tester, quota, telemetry, export)
   - Generate New Edge Router Proxy Key:
     [ACTION:GENERATE_PROXY_KEY]

CRITICAL LANGUAGE & VOICE MATCHING MANDATE:
1. ALWAYS detect and reply in the EXACT SAME language, dialect, and script that the user uses:
   - If user speaks or writes in Hindi (देवनागरी या Roman Hinglish, e.g. "Tum kahan ho", "Site chala do"), reply in fluent, crystal-clear, friendly Hindi/Hinglish.
   - If user writes/speaks in English, reply in crisp English.
2. Be confident, warm, proactive, and direct. When user asks who you are, where you are, or what you can do, explain proudly and clearly!`;
}

// Router Copilot API - Autonomous Site Operator
app.post("/api/copilot/chat", async (req, res) => {
  try {
    const { messages, currentRouterState, modelType, userApiKey } = req.body;
    const clientKey = (req.headers["x-gemini-key"] as string) || userApiKey;
    const ai = await getGenAIClient(clientKey);

    let model = "gemini-3.5-flash";
    if (modelType === "complex" || modelType === "reasoning") {
      model = "gemini-3.1-pro-preview";
    } else if (modelType === "fast" || modelType === "lite") {
      model = "gemini-3.1-flash-lite";
    }

    const systemInstruction = getRouterOperatorInstruction(currentRouterState);

    // Convert chat history into contents format
    const contents = messages.map((m: { role: string; content: string }) => ({
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
});

// Real-time Text-To-Speech for voice replies
app.post("/api/copilot/tts", async (req, res) => {
  try {
    const { text, userApiKey } = req.body;
    const clientKey = (req.headers["x-gemini-key"] as string) || userApiKey;
    const ai = await getGenAIClient(clientKey);
    const { Modality } = await import("@google/genai");

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: text.slice(0, 500) }] }],
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
});

// Internal alias of the single gateway for the in-app Tester (same per-user key, same Gemini backend)
app.post("/api/router/inference", async (req, res) => {
  const startTime = Date.now();
  try {
    const { prompt, model = "gemini-2.5-flash", clientApiKey } = req.body;
    const clientKey = (req.headers["x-gemini-key"] as string) || clientApiKey || process.env.GEMINI_API_KEY;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing prompt parameter" });
    }
    if (!clientKey) {
      return res.status(401).json({ error: "Login required: pehle signup me Gemini key dalo." });
    }

    // If API key is available, execute real Gemini call
    if (clientKey) {
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
    }

    // No simulated fake success: without key we already 401 above. Unreachable guard.
    return res.status(401).json({ error: "Login required: pehle signup me Gemini key dalo." });
  } catch (err: any) {
    console.error("Inference route error:", err);
    const latencyMs = Date.now() - startTime;
    return res.status(500).json({
      error: err.message || "Inference failed",
      latencyMs,
    });
  }
});

// SINGLE public gateway — sole endpoint for all external clients (site Export tab, curl, Python, OpenCode)
app.post("/api/v1/chat/completions", async (req, res) => {
  const startTime = Date.now();
  try {
    const clientKey = resolvePublicUserKey(req);

    const { messages = [], model = "gemini-2.5-flash", max_tokens = 800, temperature = 0.7 } = req.body;

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

    const ai = await getGenAIClient(clientKey);
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
});

// WebSocket Live API — wired only inside startServer() (long-lived servers).
// Never runs on serverless: no top-level side effects here.
async function initLiveSockets(httpServer: any) {
  const { WebSocketServer, WebSocket } = await import("ws") as any;
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request: any, socket: any, head: any) => {
    const url = new URL(request.url || "", `http://${request.headers.host}`);
    if (url.pathname === "/api/copilot/live") {
      wss.handleUpgrade(request, socket, head, (ws: any) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", async (clientWs: any, req: any) => {
    console.log("Client connected to Gemini Live voice stream");
    let session: any = null;

    try {
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      const clientKey = url.searchParams.get("key") || process.env.GEMINI_API_KEY;
      const activeProvider = url.searchParams.get("activeProvider") || "Cerebras / Groq";
      const policy = url.searchParams.get("policy") || "lowest-latency";
      const nodeCount = url.searchParams.get("nodeCount") || "12";
      const fallback = url.searchParams.get("fallback") || "Cerebras -> Groq -> Gemini";
      const ai = await getGenAIClient(clientKey || undefined);
      const { Modality } = await import("@google/genai");

    const liveInstruction = getRouterOperatorInstruction({
      activeProvider,
      policy,
      totalEndpoints: nodeCount,
      fallbackChain: [fallback],
      avgLatency: 18,
    });

    session = await ai.live.connect({
      model: "gemini-3.1-flash-live-preview",
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
        },
        systemInstruction: liveInstruction,
      },
      callbacks: {
        onmessage: (message: any) => {
          const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audio && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ audio }));
          }

          const textPart = message.serverContent?.modelTurn?.parts?.find((p: any) => p.text)?.text;
          if (textPart && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ text: textPart }));
          }

          if (message.serverContent?.interrupted && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ interrupted: true }));
          }
        },
      },
    });

    clientWs.on("message", (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.audio && session) {
          session.sendRealtimeInput({
            audio: { data: parsed.audio, mimeType: "audio/pcm;rate=16000" },
          });
        }
      } catch (err) {
        console.error("Error processing client live input:", err);
      }
    });

    clientWs.on("close", () => {
      console.log("Live client disconnected");
      if (session) {
        try {
          session.close();
        } catch (_) {}
      }
    });
  } catch (err: any) {
    console.error("Live API connection failed:", err);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ error: err.message || "Live API connection failed" }));
      clientWs.close();
    }
  }
  });
} // end initLiveSockets (long-lived servers only)

// Vite middleware / static asset serving (long-lived servers only)
async function startServer() {
  if (!server) {
    server = http.createServer(app);
    await initLiveSockets(server).catch((e) =>
      console.error("Live socket init failed:", e)
    );
  }
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Edge Router full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

// Auto-start only on real long-lived servers — never serverless, never tests.
if (process.env.NODE_ENV !== "test" && !IS_SERVERLESS) {
  startServer().catch((e) => console.error("Server start failed:", e));
}

export { app, server, startServer };
export default app;
