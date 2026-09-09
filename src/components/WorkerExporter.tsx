import React, { useState } from 'react';
import { 
  Code2, 
  Copy, 
  Check, 
  Download, 
  Upload, 
  Terminal, 
  Server, 
  FileText,
  Globe,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
  Key,
  Eye,
  EyeOff,
  RefreshCw,
  Lock,
  CheckCircle2
} from 'lucide-react';
import { Endpoint, Provider, RoutingPolicy } from '../types/router';

interface WorkerExporterProps {
  activeProvider: Provider;
  providers?: Provider[];
  endpoints: Endpoint[];
  routingPolicy: RoutingPolicy;
  fallbackChain?: string[];
  onImportConfig: (data: { providers?: Provider[]; endpoints?: Endpoint[] }) => void;
}

export const WorkerExporter: React.FC<WorkerExporterProps> = ({
  activeProvider,
  providers = [],
  endpoints,
  routingPolicy,
  fallbackChain = [],
  onImportConfig,
}) => {
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<'curl' | 'python' | 'node' | 'opencode' | 'nextjs'>('python');
  const [proxyModel, setProxyModel] = useState<'auto-free-best' | 'fastest-free' | 'smartest-reasoning' | string>('auto-free-best');

  // Edge Proxy Master API Key State (persisted locally so it remains constant across sessions)
  const [proxyApiKey, setProxyApiKey] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('edge_router_proxy_key');
      if (saved && saved.startsWith('sk-er-live-')) return saved;
    } catch (_) {}

    // Cryptographically secure 32-character hex key
    const rand = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const initialKey = `sk-er-live-${rand}`;
    try {
      localStorage.setItem('edge_router_proxy_key', initialKey);
    } catch (_) {}
    return initialKey;
  });

  const [showApiKey, setShowApiKey] = useState(false);
  const [justRegenerated, setJustRegenerated] = useState(false);

  const handleGenerateNewKey = () => {
    const rand = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const newKey = `sk-er-live-${rand}`;
    setProxyApiKey(newKey);
    try {
      localStorage.setItem('edge_router_proxy_key', newKey);
    } catch (_) {}
    setJustRegenerated(true);
    setTimeout(() => setJustRegenerated(false), 3000);
  };

  const providerEndpoints = endpoints.filter(
    (ep) => ep.providerId === activeProvider.id && ep.enabled
  );

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const universalBaseUrl = 'https://proxy.edgeroute.workers.dev/v1';

  // Client code snippets for universal BaseURL with real generated API Key
  const codeSnippets: Record<'curl' | 'python' | 'node' | 'opencode' | 'nextjs', string> = {
    curl: `curl -X POST "${universalBaseUrl}/chat/completions" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${proxyApiKey}" \\
  -H "X-Route-Policy: ${routingPolicy}" \\
  -H "X-Auto-Fallback: true" \\
  -d '{
    "model": "${proxyModel}",
    "messages": [
      {"role": "system", "content": "You are routed via Edge Router Load Balancer."},
      {"role": "user", "content": "Hello! Explain quantum computing in 2 sentences."}
    ],
    "temperature": 0.7
  }'`,

    python: `from openai import OpenAI

# 1-Click Universal BaseURL with auto free-tier cascading
client = OpenAI(
    base_url="${universalBaseUrl}",
    api_key="${proxyApiKey}",
    default_headers={
        "X-Route-Policy": "${routingPolicy}",
        "X-Auto-Fallback": "true"
    }
)

response = client.chat.completions.create(
    model="${proxyModel}",  # Auto routes across Gemini -> Cerebras -> SiliconFlow -> Groq
    messages=[
        {"role": "user", "content": "How do edge distributed systems handle failovers?"}
    ],
    temperature=0.7,
)

print(response.choices[0].message.content)
print(f"Routed through provider: {response._response.headers.get('x-edge-provider')}")`,

    node: `import OpenAI from "openai";

// Drop-in replacement for OpenAI SDK with your generated Edge Key
const client = new OpenAI({
  baseURL: "${universalBaseUrl}",
  apiKey: process.env.EDGE_ROUTER_KEY || "${proxyApiKey}",
  defaultHeaders: {
    "X-Route-Policy": "${routingPolicy}",
    "X-Auto-Fallback": "true",
  },
});

async function main() {
  const completion = await client.chat.completions.create({
    model: "${proxyModel}", // 'auto-free-best' or '${activeProvider.models[0] || 'gemini-2.0-flash'}'
    messages: [
      { role: "user", content: "Summarize distributed zero-overhead edge routing." }
    ],
  });

  console.log(completion.choices[0].message.content);
}

main();`,

    opencode: `# OpenCode / Cursor / LiteLLM Configuration (.env)
# Drop-in OpenAI-compatible provider with generated Edge API key

OPENAI_API_BASE="${universalBaseUrl}"
OPENAI_BASE_URL="${universalBaseUrl}"
OPENAI_API_KEY="${proxyApiKey}"

# Models supported:
# - auto-free-best (Default: selects highest quota free provider)
# - fastest-free (Cerebras / Groq LPU sub-15ms)
# - smartest-reasoning (DeepSeek-R1 / Gemini 2.0 Flash)
# - ${activeProvider.models[0] || 'gemini-2.0-flash'}
DEFAULT_MODEL="${proxyModel}"

# LiteLLM Proxy / Router config.yaml snippet:
# model_list:
#   - model_name: free-router
#     litellm_params:
#       model: openai/${proxyModel}
#       api_base: ${universalBaseUrl}
#       api_key: "${proxyApiKey}"`,

    nextjs: `// Next.js App Router (app/api/chat/route.ts) with Vercel AI SDK
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

// Universal Edge Router Provider
const edgeRouter = createOpenAI({
  baseURL: "${universalBaseUrl}",
  apiKey: process.env.EDGE_ROUTER_KEY || "${proxyApiKey}",
  headers: {
    "X-Route-Policy": "${routingPolicy}",
    "X-Auto-Fallback": "true",
  },
});

export const runtime = "edge"; // Run directly on Vercel Edge Network

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: edgeRouter("${proxyModel}"),
    messages,
  });

  return result.toDataStreamResponse();
}`,
  };

  // Generate Cloudflare Worker TypeScript code with cross-provider auto-fallback & API Key Auth
  const workerCode = `/**
 * Edge Router - Serverless Edge API Router & Load Balancer
 * Zero server overhead • Evaluated at 300+ Edge PoPs
 * Provider: ${activeProvider.name} | Policy: ${routingPolicy}
 * Cross-Provider Fallback: Enabled (${fallbackChain.length} tiers)
 * Master Auth: Enforces Edge Router Proxy API Key
 */

interface RegionalEndpoint {
  id: string;
  providerId: string;
  providerName: string;
  name: string;
  region: string;
  url: string;
  weight: number;
  priorityTier: number;
}

// Configured Master Proxy API Key for Gateway Authentication
const PROXY_MASTER_KEY: string = "${proxyApiKey}";

const REGIONAL_NODES: RegionalEndpoint[] = ${JSON.stringify(
    endpoints
      .filter((ep) => ep.enabled)
      .map((ep) => {
        const pr = providers.find((p) => p.id === ep.providerId);
        return {
          id: ep.id,
          providerId: ep.providerId,
          providerName: pr ? pr.name : ep.providerId,
          name: ep.name,
          region: ep.region,
          url: ep.baseUrl,
          weight: ep.weight,
          priorityTier: ep.priorityTier,
        };
      }),
    null,
    2
  )};

const FALLBACK_CHAIN = ${JSON.stringify(fallbackChain)};
const ROUTING_POLICY: string = "${routingPolicy}";

export default {
  async fetch(request: Request, env: Record<string, string>, ctx: ExecutionContext): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

    // 0. Enforce Edge Router Proxy API Key Authorization
    const authHeader = request.headers.get("Authorization");
    const providedKey = authHeader ? authHeader.replace(/^Bearer\\s+/i, "").trim() : "";
    
    if (PROXY_MASTER_KEY && providedKey !== PROXY_MASTER_KEY) {
      return new Response(JSON.stringify({
        error: {
          message: "Unauthorized: Invalid or missing Edge Router Proxy API Key",
          type: "invalid_request_error",
          code: "invalid_api_key",
          hint: "Set Authorization: Bearer ${proxyApiKey.substring(0, 14)}..."
        }
      }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        }
      });
    }

    // 1. Resolve Universal Model Aliases
    const clonedReq = request.clone();
    let bodyJson: Record<string, unknown> = {};
    try {
      bodyJson = await clonedReq.json();
    } catch (_) {}

    const reqModel = (bodyJson.model as string) || "auto-free-best";
    let targetProvider = "${activeProvider.id}";

    if (reqModel === "fastest-free") {
      targetProvider = "prov-cerebras";
    } else if (reqModel === "smartest-reasoning") {
      targetProvider = "prov-siliconflow";
    }

    // 2. Select primary node for active provider
    let availableNodes = REGIONAL_NODES.filter(n => n.providerId === targetProvider);
    if (availableNodes.length === 0) availableNodes = REGIONAL_NODES;

    let targetNode = selectEndpoint(availableNodes);
    let start = performance.now();
    let response: Response;
    let fallbackOccurred = false;
    let finalNode = targetNode;

    try {
      response = await forwardRequest(request, targetNode);

      // 3. Automated Cross-Provider Fallback on 429 (Quota Exceeded) or 5xx
      if (response.status === 429 || response.status >= 500) {
        console.warn(\`[429 Quota Hit] Cascading from \${targetNode.providerName} to fallback chain\`);
        
        for (const nextProviderId of FALLBACK_CHAIN) {
          if (nextProviderId === targetNode.providerId) continue;
          const fallbackCandidates = REGIONAL_NODES.filter(n => n.providerId === nextProviderId);
          if (fallbackCandidates.length === 0) continue;

          const candidateNode = selectEndpoint(fallbackCandidates);
          const fallbackResp = await forwardRequest(request, candidateNode);
          if (fallbackResp.status === 200) {
            response = fallbackResp;
            finalNode = candidateNode;
            fallbackOccurred = true;
            break;
          }
        }
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: "Edge router upstream failure", detail: String(err) }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const latency = Math.round(performance.now() - start);

    // 4. Inject Edge Telemetry Headers
    const headers = new Headers(response.headers);
    headers.set("x-edge-router", "edge-router-v1");
    headers.set("x-edge-provider", finalNode.providerName);
    headers.set("x-edge-region", finalNode.region);
    headers.set("x-edge-latency-ms", latency.toString());
    headers.set("x-fallback-occurred", fallbackOccurred ? "true" : "false");

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  },
};

async function forwardRequest(request: Request, node: RegionalEndpoint): Promise<Response> {
  const targetUrl = new URL(request.url);
  const originUrl = new URL(node.url);
  targetUrl.protocol = originUrl.protocol;
  targetUrl.hostname = originUrl.hostname;
  targetUrl.port = originUrl.port;

  return fetch(targetUrl.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });
}

function selectEndpoint(nodes: RegionalEndpoint[]): RegionalEndpoint {
  if (nodes.length === 0) throw new Error("No nodes available");
  if (nodes.length === 1) return nodes[0];
  const totalWeight = nodes.reduce((sum, n) => sum + n.weight, 0);
  let random = Math.random() * totalWeight;
  for (const node of nodes) {
    random -= node.weight;
    if (random <= 0) return node;
  }
  return nodes[0];
}
`;

  // JSON export
  const exportConfigJson = () => {
    const data = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      activeProvider,
      fallbackChain,
      routingPolicy,
      endpoints,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `edgeroute-universal-router-config.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.endpoints && Array.isArray(json.endpoints)) {
          onImportConfig(json);
        }
      } catch (err) {
        alert('Invalid JSON configuration file');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-16 font-mono min-w-0 max-w-full overflow-hidden">
      {/* Header */}
      <div className="border-b border-neutral-800/80 pb-4 sm:pb-6 space-y-2 min-w-0 max-w-full overflow-hidden">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs uppercase tracking-widest text-neutral-400">
          <span>1-CLICK INTEGRATION</span>
          <span>//</span>
          <span className="text-emerald-400 font-semibold">UNIVERSAL BASEURL PROXY</span>
          <span>//</span>
          <span>OPENAI-COMPATIBLE</span>
        </div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-white uppercase break-words">
          UNIVERSAL PROXY &amp; CLIENT CODE
        </h1>
        <p className="text-xs sm:text-sm text-neutral-400 font-sans max-w-3xl leading-relaxed break-words">
          One unified endpoint for your entire application stack. Connect Cursor, OpenCode, Next.js, Python, or LangChain to <strong className="text-white break-all">https://proxy.edgeroute.workers.dev/v1</strong>. When any provider hits daily free token limits, traffic cascades to the next free API automatically.
        </p>
      </div>

      {/* Hero Proxy Endpoint & API Key Card */}
      <div className="bg-neutral-900/80 border border-neutral-700 p-3.5 sm:p-6 space-y-5 shadow-xl min-w-0 max-w-full overflow-hidden">
        {/* Row 1: Universal Base URL */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4 min-w-0">
          <div className="space-y-1 min-w-0 max-w-full">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-neutral-500 uppercase tracking-widest block truncate">
                1. UNIVERSAL OPENAI-COMPATIBLE BASE URL
              </span>
              <span className="text-[9px] bg-neutral-800 text-neutral-300 px-1 py-0.2 border border-neutral-700">
                GLOBAL INGRESS
              </span>
            </div>
            <div className="flex items-center gap-2 min-w-0 max-w-full">
              <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 flex-shrink-0" />
              <code className="text-xs sm:text-sm md:text-base text-white font-bold tracking-tight sm:tracking-wide break-all min-w-0">
                {universalBaseUrl}
              </code>
            </div>
          </div>

          <button
            onClick={() => copyToClipboard(universalBaseUrl, 'baseurl')}
            className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-neutral-100 hover:bg-white text-neutral-950 font-bold text-xs uppercase tracking-wider transition-colors min-h-[42px] flex-shrink-0 w-full sm:w-auto"
          >
            {copiedType === 'baseurl' ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span>COPIED URL</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>COPY BASE URL</span>
              </>
            )}
          </button>
        </div>

        {/* Row 2: Generated Proxy Master API Key */}
        <div className="border-b border-neutral-800 pb-4 space-y-3 min-w-0 max-w-full">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-neutral-500 uppercase tracking-widest block truncate">
                2. EDGE PROXY MASTER API KEY (AUTHORIZATION)
              </span>
              <span className="text-[9px] bg-emerald-950/60 text-emerald-400 border border-emerald-800/80 px-1.5 py-0.5 font-bold">
                GATEWAY AUTH ACTIVE
              </span>
            </div>
            {justRegenerated && (
              <span className="text-[11px] text-emerald-400 font-sans flex items-center gap-1 animate-pulse">
                <CheckCircle2 className="w-3.5 h-3.5" /> New Key Generated &amp; Saved
              </span>
            )}
          </div>

          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 bg-neutral-950 p-2.5 sm:p-3 border border-neutral-800">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <Key className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <code className="text-xs sm:text-sm text-neutral-200 font-mono font-bold tracking-wide break-all select-all">
                  {showApiKey ? proxyApiKey : `${proxyApiKey.substring(0, 10)}••••••••••••••••••••••••••••••••`}
                </code>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap flex-shrink-0">
              {/* Show / Hide */}
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                title={showApiKey ? "Hide key" : "Show full key"}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-750 text-xs font-mono transition-colors"
              >
                {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showApiKey ? "HIDE" : "SHOW"}</span>
              </button>

              {/* Copy Key */}
              <button
                type="button"
                onClick={() => copyToClipboard(proxyApiKey, 'proxykey')}
                className="flex items-center gap-1 px-3 py-1.5 bg-neutral-100 hover:bg-white text-neutral-950 font-bold text-xs font-mono uppercase tracking-wider transition-colors"
              >
                {copiedType === 'proxykey' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>COPIED KEY</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>COPY KEY</span>
                  </>
                )}
              </button>

              {/* Generate / Rotate New Key */}
              <button
                type="button"
                onClick={handleGenerateNewKey}
                title="Generate a new Edge Router Proxy API Key"
                className="flex items-center gap-1 px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-emerald-400 hover:text-emerald-300 border border-neutral-750 text-xs font-mono transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${justRegenerated ? 'animate-spin' : ''}`} />
                <span>NEW KEY</span>
              </button>
            </div>
          </div>

          <p className="text-[11px] text-neutral-400 font-sans leading-relaxed">
            Use this key as <code className="text-neutral-200 font-mono bg-neutral-950 px-1 border border-neutral-800">OPENAI_API_KEY</code> in Cursor, OpenCode, Next.js, or as <code className="text-neutral-200 font-mono bg-neutral-950 px-1 border border-neutral-800">Authorization: Bearer &lt;key&gt;</code>. It is evaluated and validated at the edge layer before routing to backend providers.
          </p>

          {/* 1-Click Quick Setup Helpers for Terminal / .env / Cursor */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-1">
            <span className="text-[10px] text-neutral-500 uppercase font-mono tracking-wider">
              1-Click Setup:
            </span>
            <button
              type="button"
              onClick={() => copyToClipboard(`OPENAI_BASE_URL="${universalBaseUrl}"\nOPENAI_API_KEY="${proxyApiKey}"`, 'env_config')}
              className="flex items-center gap-1 px-2.5 py-1 bg-neutral-950 hover:bg-neutral-850 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white text-[11px] font-mono transition-colors"
            >
              {copiedType === 'env_config' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>Copy .env Snippet</span>
            </button>
            <button
              type="button"
              onClick={() => copyToClipboard(`export OPENAI_BASE_URL="${universalBaseUrl}"\nexport OPENAI_API_KEY="${proxyApiKey}"`, 'cli_export')}
              className="flex items-center gap-1 px-2.5 py-1 bg-neutral-950 hover:bg-neutral-850 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white text-[11px] font-mono transition-colors"
            >
              {copiedType === 'cli_export' ? <Check className="w-3 h-3 text-emerald-400" /> : <Terminal className="w-3 h-3" />}
              <span>Copy CLI export Command</span>
            </button>
            <button
              type="button"
              onClick={() => copyToClipboard(JSON.stringify({ "openai.baseURL": universalBaseUrl, "openai.apiKey": proxyApiKey }, null, 2), 'cursor_json')}
              className="flex items-center gap-1 px-2.5 py-1 bg-neutral-950 hover:bg-neutral-850 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white text-[11px] font-mono transition-colors"
            >
              {copiedType === 'cursor_json' ? <Check className="w-3 h-3 text-emerald-400" /> : <Code2 className="w-3 h-3" />}
              <span>Copy Cursor / VS Code JSON</span>
            </button>
          </div>
        </div>

        {/* Model Alias Selector */}
        <div className="space-y-2 pt-1 min-w-0 max-w-full">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-400 text-[11px] uppercase">Select Model Preset:</span>
            <span className="text-emerald-400 text-[11px]">Auto-failover enabled</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs min-w-0 max-w-full">
            {[
              {
                id: 'auto-free-best',
                title: 'auto-free-best',
                desc: 'Cascades through all daily free tiers with highest capacity',
              },
              {
                id: 'fastest-free',
                title: 'fastest-free',
                desc: 'Targets Cerebras / Groq LPU sub-15ms inference',
              },
              {
                id: 'smartest-reasoning',
                title: 'smartest-reasoning',
                desc: 'Routes to DeepSeek-R1 / Gemini 2.0 Flash / Qwen 2.5 72B',
              },
            ].map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setProxyModel(preset.id)}
                className={`p-3 text-left border transition-all ${
                  proxyModel === preset.id
                    ? 'border-emerald-500 bg-neutral-950 text-white shadow-md'
                    : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs">{preset.title}</span>
                  {proxyModel === preset.id && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <p className="text-[10px] text-neutral-500 font-sans mt-1 leading-snug">{preset.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Multi-Language Code Generator */}
      <div className="bg-neutral-900/60 border border-neutral-800 p-3.5 sm:p-6 space-y-4 min-w-0 max-w-full overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <Terminal className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <h3 className="text-xs font-bold uppercase text-white tracking-wider truncate">
              Client Code Snippets ({selectedLanguage.toUpperCase()})
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 min-w-0 max-w-full">
            {[
              { id: 'python', label: 'Python' },
              { id: 'node', label: 'TypeScript / Node' },
              { id: 'curl', label: 'cURL' },
              { id: 'opencode', label: 'OpenCode / Cursor' },
              { id: 'nextjs', label: 'Next.js AI SDK' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedLanguage(tab.id as any)}
                className={`px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs transition-colors ${
                  selectedLanguage === tab.id
                    ? 'bg-neutral-800 text-white font-bold border border-neutral-700'
                    : 'text-neutral-400 hover:text-white border border-transparent'
                }`}
              >
                {tab.label}
              </button>
            ))}

            <button
              onClick={() => copyToClipboard(codeSnippets[selectedLanguage], 'snippet')}
              className="flex items-center gap-1 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 hover:text-white border border-neutral-700 text-xs uppercase transition-colors ml-auto sm:ml-2 min-h-[34px]"
            >
              {copiedType === 'snippet' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>COPIED</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>COPY</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="min-w-0 max-w-full overflow-hidden">
          <pre className="p-3 sm:p-4 bg-neutral-950 border border-neutral-800 text-[11px] sm:text-xs text-neutral-300 overflow-x-auto leading-relaxed max-h-[420px] max-w-full whitespace-pre">
            {codeSnippets[selectedLanguage]}
          </pre>
        </div>
      </div>

      {/* Lower Section: Full Edge Worker Script & Config Export */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-w-0 max-w-full">
        {/* Cloudflare Worker Script (Span 8) */}
        <div className="lg:col-span-8 bg-neutral-900/60 border border-neutral-800 p-3.5 sm:p-6 space-y-4 min-w-0 max-w-full overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-3 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <Code2 className="w-4 h-4 text-neutral-400 flex-shrink-0" />
              <h3 className="text-xs font-bold uppercase text-white tracking-wider truncate">
                Full Edge Worker Code (With Cross-Provider Fallback)
              </h3>
            </div>
            <button
              onClick={() => copyToClipboard(workerCode, 'worker')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 hover:text-white border border-neutral-700 text-xs uppercase transition-colors w-fit flex-shrink-0"
            >
              {copiedType === 'worker' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>COPIED WORKER</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>COPY WORKER CODE</span>
                </>
              )}
            </button>
          </div>

          <div className="min-w-0 max-w-full overflow-hidden">
            <pre className="p-3 sm:p-3.5 bg-neutral-950 border border-neutral-800 text-[11px] sm:text-xs text-neutral-300 overflow-x-auto max-h-[400px] leading-relaxed max-w-full whitespace-pre">
              {workerCode}
            </pre>
          </div>
        </div>

        {/* Configuration Portability (Span 4) */}
        <div className="lg:col-span-4 bg-neutral-900/60 border border-neutral-800 p-3.5 sm:p-6 space-y-4 min-w-0 max-w-full overflow-hidden">
          <div className="border-b border-neutral-800 pb-3">
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider">PORTABILITY</span>
            <h3 className="text-xs font-bold uppercase text-white tracking-wider mt-0.5">
              ROUTER CONFIGURATION
            </h3>
          </div>

          <p className="text-xs font-sans text-neutral-400 leading-relaxed">
            Download your full multi-provider configuration, regional nodes, quota policies, and fallback sequence as a portable JSON file.
          </p>

          <div className="space-y-2.5 pt-2">
            <button
              onClick={exportConfigJson}
              className="w-full flex items-center justify-center gap-2 py-3 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 hover:text-white border border-neutral-700 text-xs uppercase tracking-wider transition-colors min-h-[44px]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>EXPORT CONFIG JSON</span>
            </button>

            <label className="w-full flex items-center justify-center gap-2 py-3 bg-neutral-950 hover:bg-neutral-900 text-neutral-300 hover:text-white border border-neutral-800 hover:border-neutral-700 text-xs uppercase tracking-wider cursor-pointer transition-colors min-h-[44px]">
              <Upload className="w-3.5 h-3.5" />
              <span>IMPORT CONFIG JSON</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
