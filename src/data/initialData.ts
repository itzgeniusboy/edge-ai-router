import { Provider, Endpoint } from '../types/router';

// SINGLE-PROVIDER MODE: one Gemini gateway, per-user Gemini keys.
// Endpoint is single global-anycast node. User keys differ per login.

export const INITIAL_PROVIDERS: Provider[] = [
  {
    id: 'prov-gemini',
    name: 'Google Gemini',
    slug: 'google-gemini',
    category: 'LLM & Multimodal',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: ['gemini-flash-latest', 'gemini-3.6-flash', 'gemini-pro-latest', 'gemini-flash-lite-latest'],
    dailyTokenQuota: '1,500 RPD • Free',
  },
];

export const INITIAL_ENDPOINTS: Endpoint[] = [
  {
    id: 'ep-gemini-anycast',
    providerId: 'prov-gemini',
    name: 'Global Anycast Gateway',
    region: 'global-anycast',
    regionLabel: 'Global Anycast',
    apiKey: '',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    weight: 100,
    priorityTier: 1,
    status: 'healthy',
    latencyMs: 12,
    uptimePercentage: 99.99,
    rateLimitRpm: 1500,
    rateLimitRemaining: 1500,
    totalRouted: 0,
    errorsCount: 0,
    enabled: true,
    lastChecked: Date.now(),
  },
];

export const INITIAL_FALLBACK_CHAIN: string[] = ['prov-gemini'];

export const INITIAL_DAILY_USAGES: Record<string, {
  requestsUsed: number;
  requestsLimit: number;
  tokensUsed: number;
  tokensLimit: number;
  primaryUnit: 'requests' | 'tokens';
}> = {
  'prov-gemini': {
    requestsUsed: 0,
    requestsLimit: 1500,
    tokensUsed: 0,
    tokensLimit: 1000000,
    primaryUnit: 'requests',
  },
};
