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

    const uni = providers[0];
    const uniSlug = uni?.slug || 'edge-router-universal';
    const pickModel = (want: string, fallback: string) =>
      uni && uni.models.includes(want) ? want : uni?.models[0] || fallback;

    if (isCodeOrMath) {
      return {
        taskType: 'code-reasoning',
        recommendedProviderSlug: uniSlug,
        recommendedModel: pickModel('gemini-pro-latest', 'gemini-flash-latest'),
        reasoning: 'Detected complex logic/coding requirement. Reasoning model auto-routed.',
        estimatedLatencyMs: 35,
      };
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
      return {
        taskType: 'fast-chat',
        recommendedProviderSlug: uniSlug,
        recommendedModel: pickModel('llama-3.3-70b-versatile', 'gemini-flash-latest'),
        reasoning: 'Detected real-time / low-latency query. Fastest route auto-selected.',
        estimatedLatencyMs: 14,
      };
    }

    // 3. Balanced general request
    return {
      taskType: 'general',
      recommendedProviderSlug: uniSlug,
      recommendedModel: pickModel('gemini-flash-latest', uni?.models[0] || 'gemini-flash-latest'),
      reasoning: 'Balanced speed + quality route auto-selected.',
      estimatedLatencyMs: 22,
    };
  }
}
