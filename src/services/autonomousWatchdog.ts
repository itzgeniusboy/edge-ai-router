import { Endpoint, Provider, RoutingPolicy, WatchdogEvent } from '../types/router';

export class AutonomousWatchdogService {
  /**
   * Evaluates the current edge router health and runs proactive self-healing if anomalies are detected
   */
  static runHealthCheckAndHeal(params: {
    endpoints: Endpoint[];
    activeProvider: Provider;
    providers: Provider[];
    fallbackChain: string[];
    dailyUsages: Record<string, { requestsUsed: number; requestsLimit: number; tokensUsed: number; tokensLimit: number }>;
    routingPolicy: RoutingPolicy;
  }): {
    healed: boolean;
    event?: WatchdogEvent;
    updatedEndpoints?: Endpoint[];
    newActiveProviderId?: string;
    newRoutingPolicy?: RoutingPolicy;
  } {
    const { endpoints, activeProvider, providers, fallbackChain, dailyUsages, routingPolicy } = params;
    const now = Date.now();

    // 1. Quota exhaustion / 85% safety check
    const currentUsage = dailyUsages[activeProvider.id];
    if (currentUsage) {
      const tokenRatio = currentUsage.tokensLimit > 0 ? currentUsage.tokensUsed / currentUsage.tokensLimit : 0;
      const reqRatio = currentUsage.requestsLimit > 0 ? currentUsage.requestsUsed / currentUsage.requestsLimit : 0;
      const highestRatio = Math.max(tokenRatio, reqRatio);

      if (highestRatio >= 0.85 && fallbackChain.length > 1) {
        const nextProviderId = fallbackChain.find((id) => id !== activeProvider.id);
        const nextProvider = providers.find((p) => p.id === nextProviderId);
        if (nextProvider) {
          return {
            healed: true,
            newActiveProviderId: nextProvider.id,
            event: {
              id: 'wd_' + Math.random().toString(36).substring(2, 9),
              timestamp: now,
              type: 'quota_alert',
              title: `Autonomous Quota Guard: Auto-switched to [${nextProvider.name}]`,
              description: `Provider [${activeProvider.name}] daily quota reached ${(highestRatio * 100).toFixed(1)}%.`,
              actionTaken: `Automated zero-downtime cascade to fallback provider [${nextProvider.name}].`,
              affectedProvider: activeProvider.name,
            },
          };
        }
      }
    }

    // 2. High Latency & Jitter Check on Active Endpoints
    const activeEndpoints = endpoints.filter((e) => e.providerId === activeProvider.id && e.enabled);
    if (activeEndpoints.length >= 2) {
      // Sort by latency
      const sortedByLatency = [...activeEndpoints].sort((a, b) => a.latencyMs - b.latencyMs);
      const fastest = sortedByLatency[0];
      const slowest = sortedByLatency[sortedByLatency.length - 1];

      // If slowest active node has high latency (> 65ms) and is Tier 1, deprioritize or optimize policy
      if (slowest.latencyMs > 65 && slowest.priorityTier === 1 && fastest.latencyMs < 30) {
        const updated = endpoints.map((ep) => {
          if (ep.id === slowest.id) {
            return { ...ep, priorityTier: 2, lastChecked: now };
          }
          if (ep.id === fastest.id) {
            return { ...ep, priorityTier: 1, lastChecked: now };
          }
          return ep;
        });

        return {
          healed: true,
          updatedEndpoints: updated,
          event: {
            id: 'wd_' + Math.random().toString(36).substring(2, 9),
            timestamp: now,
            type: 'heal',
            title: `Auto-Healed Node Latency Spike on [${slowest.name}]`,
            description: `Node latency spiked to ${slowest.latencyMs}ms. Fastest healthy node [${fastest.name}] is responding in ${fastest.latencyMs}ms.`,
            actionTaken: `Demoted [${slowest.name}] to Tier 2 and promoted [${fastest.name}] to primary ingress.`,
            affectedEndpoint: slowest.name,
            latencyBefore: slowest.latencyMs,
            latencyAfter: fastest.latencyMs,
          },
        };
      }

      // If policy is not lowest-latency and latency gap is huge (> 40ms)
      if (routingPolicy !== 'lowest-latency' && slowest.latencyMs - fastest.latencyMs > 45) {
        return {
          healed: true,
          newRoutingPolicy: 'lowest-latency',
          event: {
            id: 'wd_' + Math.random().toString(36).substring(2, 9),
            timestamp: now,
            type: 'route_optimize',
            title: `Policy Auto-Tuned: Switched to Lowest-Latency`,
            description: `Detected high inter-regional latency variance (${slowest.latencyMs - fastest.latencyMs}ms difference).`,
            actionTaken: `Autonomous policy override applied: Set to 'lowest-latency' to lock in ${fastest.latencyMs}ms resolution.`,
            latencyBefore: slowest.latencyMs,
            latencyAfter: fastest.latencyMs,
          },
        };
      }
    }

    return { healed: false };
  }
}

export interface PromptAnalysis {
  taskType: 'code-reasoning' | 'fast-chat' | 'bulk-data' | 'general';
  recommendedProviderSlug: string;
  recommendedModel: string;
  reasoning: string;
  estimatedLatencyMs: number;
}

export class SmartPromptRouter {
  /**
   * Intelligently classifies prompt intent and selects the optimal provider & model
   */
  static analyzePrompt(prompt: string, providers: Provider[]): PromptAnalysis {
    const text = prompt.toLowerCase();

    // 1. Heavy reasoning, coding, math, complex problem solving
    const isCodeOrMath =
      text.includes('code') ||
      text.includes('function') ||
      text.includes('typescript') ||
      text.includes('python') ||
      text.includes('sql') ||
      text.includes('algorithm') ||
      text.includes('math') ||
      text.includes('prove') ||
      text.includes('explain step-by-step') ||
      text.includes('architecture') ||
      text.includes('debug');

    if (isCodeOrMath) {
      const deepseek = providers.find((p) => p.slug === 'deepseek');
      const gemini = providers.find((p) => p.slug === 'gemini');
      const oai = providers.find((p) => p.slug === 'openai');

      if (deepseek) {
        return {
          taskType: 'code-reasoning',
          recommendedProviderSlug: 'deepseek',
          recommendedModel: deepseek.models[0] || 'deepseek-reasoner-r1',
          reasoning: 'Detected complex logic/coding requirement. DeepSeek R1 reasoning model provides highest accuracy.',
          estimatedLatencyMs: 42,
        };
      } else if (gemini) {
        return {
          taskType: 'code-reasoning',
          recommendedProviderSlug: 'gemini',
          recommendedModel: 'gemini-3.1-pro-preview',
          reasoning: 'Detected complex prompt. Gemini 3.1 Pro preview selected for deep analytical reasoning.',
          estimatedLatencyMs: 35,
        };
      } else if (oai) {
        return {
          taskType: 'code-reasoning',
          recommendedProviderSlug: 'openai',
          recommendedModel: 'gpt-4o',
          reasoning: 'Routed to OpenAI GPT-4o for high-precision code synthesis.',
          estimatedLatencyMs: 38,
        };
      }
    }

    // 2. Short, real-time, ping, latency-sensitive query
    const isUltraFast =
      prompt.length < 70 ||
      text.includes('ping') ||
      text.includes('speed') ||
      text.includes('fast') ||
      text.includes('hello') ||
      text.includes('status') ||
      text.includes('quick');

    if (isUltraFast) {
      const cerebras = providers.find((p) => p.slug === 'cerebras');
      const groq = providers.find((p) => p.slug === 'groq');

      if (cerebras) {
        return {
          taskType: 'fast-chat',
          recommendedProviderSlug: 'cerebras',
          recommendedModel: cerebras.models[0] || 'llama3.1-8b-instant',
          reasoning: 'Detected real-time / low-latency query. Cerebras CS-3 LPU delivers 10ms sub-millisecond TTFT.',
          estimatedLatencyMs: 10,
        };
      } else if (groq) {
        return {
          taskType: 'fast-chat',
          recommendedProviderSlug: 'groq',
          recommendedModel: groq.models[0] || 'llama-3.3-70b-versatile',
          reasoning: 'Detected interactive query. Groq LPU engine selected for ~18ms edge speed.',
          estimatedLatencyMs: 18,
        };
      }
    }

    // 3. Balanced general request
    const gemini = providers.find((p) => p.slug === 'gemini');
    if (gemini) {
      return {
        taskType: 'general',
        recommendedProviderSlug: 'gemini',
        recommendedModel: 'gemini-2.5-flash',
        reasoning: 'Selected Gemini 2.5 Flash for optimum balance of speed, multimodal intelligence, and zero cost.',
        estimatedLatencyMs: 22,
      };
    }

    // Default to active provider
    return {
      taskType: 'general',
      recommendedProviderSlug: providers[0]?.slug || 'groq',
      recommendedModel: providers[0]?.models[0] || 'default-model',
      reasoning: 'Selected active primary edge provider.',
      estimatedLatencyMs: 25,
    };
  }
}
