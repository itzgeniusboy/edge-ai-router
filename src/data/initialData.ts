import { Provider, Endpoint } from '../types/router';

// UNIVERSAL MODE: ONE provider (Edge Router) — sab models, sab keys, auto-route.
// Model naam se upstream select hota hai; providerId dene ki zaroorat nahi.
// No hardcoded secrets: every key is per-user (KEYS UI / Copilot).
// Pool: er_api_keys_Edge Router (key prefix se upstream auto-detect).

export const UNIVERSAL_MODELS: string[] = [
  'gemini-flash-latest',
  'gemini-3.6-flash',
  'gemini-pro-latest',
  'gemini-flash-lite-latest',
  'llama-3.3-70b-versatile',
  'mixtral-8x7b-32768',
  'gemma2-9b-it',
  'google/gemma-4-31b-it:free',
  'nex-agi/nex-n2.5-mini:free',
  'liquid/lfm-2.5-2.6b:free',
  'llama-3.3-70b',
  'llama3.1-8b',
];

export const INITIAL_PROVIDERS: Provider[] = [
  {
    id: 'Edge Router',
    name: 'Edge Router',
    slug: 'edge-router-universal',
    category: 'LLM & Multimodal',
    defaultBaseUrl: 'https://edge-ai-router.vercel.app/api/v1',
    models: UNIVERSAL_MODELS,
    dailyTokenQuota: 'Apni keys lagao • auto-route',
  },
];

export const INITIAL_ENDPOINTS: Endpoint[] = [
  {
    id: 'ep-universal-anycast',
    providerId: 'Edge Router',
    name: 'Universal Gateway',
    region: 'global-anycast',
    regionLabel: 'Global Anycast',
    apiKey: '',
    baseUrl: 'https://edge-ai-router.vercel.app/api/v1',
    weight: 100,
    priorityTier: 1,
    status: 'healthy',
    latencyMs: 12,
    uptimePercentage: 99.99,
    rateLimitRpm: 10000,
    rateLimitRemaining: 10000,
    totalRouted: 0,
    errorsCount: 0,
    enabled: true,
    lastChecked: Date.now(),
  },
];

export const INITIAL_FALLBACK_CHAIN: string[] = ['Edge Router'];

export const INITIAL_DAILY_USAGES: Record<string, {
  requestsUsed: number;
  requestsLimit: number;
  tokensUsed: number;
  tokensLimit: number;
  primaryUnit: 'requests' | 'tokens';
}> = {
  'Edge Router': {
    requestsUsed: 0,
    requestsLimit: 10000,
    tokensUsed: 0,
    tokensLimit: 5000000,
    primaryUnit: 'requests',
  },
};

// Legacy IDs (purane clients/chain ke liye) — sab universal pe map hote hai.
export const LEGACY_PROVIDER_IDS: string[] = [
  'prov-gemini',
  'prov-groq',
  'prov-openrouter',
  'prov-cerebras',
];
