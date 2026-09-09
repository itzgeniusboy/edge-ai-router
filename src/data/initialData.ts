import { Provider, Endpoint } from '../types/router';

// MULTI-PROVIDER MODE: gemini + groq + openrouter + cerebras.
// No hardcoded secrets: every key is per-user (Provider Keys UI / Copilot).
// Unlimited keys per provider: stored in er_api_keys_<providerId> pools.

export const INITIAL_PROVIDERS: Provider[] = [
  {
    id: 'prov-gemini',
    name: 'Google Gemini',
    slug: 'google-gemini',
    category: 'LLM & Multimodal',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: ['gemini-flash-latest', 'gemini-3.6-flash', 'gemini-pro-latest', 'gemini-flash-lite-latest'],
    dailyTokenQuota: 'Free tier • apni key lagao',
  },
  {
    id: 'prov-groq',
    name: 'Groq',
    slug: 'groq',
    category: 'LLM & Multimodal',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
    dailyTokenQuota: 'Free tier • apni key lagao',
  },
  {
    id: 'prov-openrouter',
    name: 'OpenRouter',
    slug: 'openrouter',
    category: 'LLM & Multimodal',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    models: ['openai/gpt-4o-mini', 'meta-llama/llama-3.3-70b-instruct', 'anthropic/claude-3.5-haiku'],
    dailyTokenQuota: '100+ models • 1 key',
  },
  {
    id: 'prov-cerebras',
    name: 'Cerebras',
    slug: 'cerebras',
    category: 'LLM & Multimodal',
    defaultBaseUrl: 'https://api.cerebras.ai/v1',
    models: ['llama-3.3-70b', 'llama3.1-8b'],
    dailyTokenQuota: 'Free tier • apni key lagao',
  },
];

export const INITIAL_ENDPOINTS: Endpoint[] = [
  {
    id: 'ep-gemini-anycast',
    providerId: 'prov-gemini',
    name: 'Gemini Global Gateway',
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
  {
    id: 'ep-groq-anycast',
    providerId: 'prov-groq',
    name: 'Groq Global Gateway',
    region: 'global-anycast',
    regionLabel: 'Global Anycast',
    apiKey: '',
    baseUrl: 'https://api.groq.com/openai/v1',
    weight: 100,
    priorityTier: 1,
    status: 'healthy',
    latencyMs: 14,
    uptimePercentage: 99.9,
    rateLimitRpm: 14400,
    rateLimitRemaining: 14400,
    totalRouted: 0,
    errorsCount: 0,
    enabled: true,
    lastChecked: Date.now(),
  },
  {
    id: 'ep-openrouter-anycast',
    providerId: 'prov-openrouter',
    name: 'OpenRouter Gateway',
    region: 'global-anycast',
    regionLabel: 'Global Anycast',
    apiKey: '',
    baseUrl: 'https://openrouter.ai/api/v1',
    weight: 100,
    priorityTier: 1,
    status: 'healthy',
    latencyMs: 18,
    uptimePercentage: 99.9,
    rateLimitRpm: 5000,
    rateLimitRemaining: 5000,
    totalRouted: 0,
    errorsCount: 0,
    enabled: true,
    lastChecked: Date.now(),
  },
  {
    id: 'ep-cerebras-anycast',
    providerId: 'prov-cerebras',
    name: 'Cerebras Global Gateway',
    region: 'global-anycast',
    regionLabel: 'Global Anycast',
    apiKey: '',
    baseUrl: 'https://api.cerebras.ai/v1',
    weight: 100,
    priorityTier: 1,
    status: 'healthy',
    latencyMs: 10,
    uptimePercentage: 99.9,
    rateLimitRpm: 3000,
    rateLimitRemaining: 3000,
    totalRouted: 0,
    errorsCount: 0,
    enabled: true,
    lastChecked: Date.now(),
  },
];

export const INITIAL_FALLBACK_CHAIN: string[] = ['prov-gemini', 'prov-groq', 'prov-openrouter', 'prov-cerebras'];

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
  'prov-groq': {
    requestsUsed: 0,
    requestsLimit: 14400,
    tokensUsed: 0,
    tokensLimit: 500000,
    primaryUnit: 'requests',
  },
  'prov-openrouter': {
    requestsUsed: 0,
    requestsLimit: 5000,
    tokensUsed: 0,
    tokensLimit: 2000000,
    primaryUnit: 'requests',
  },
  'prov-cerebras': {
    requestsUsed: 0,
    requestsLimit: 3000,
    tokensUsed: 0,
    tokensLimit: 1000000,
    primaryUnit: 'requests',
  },
};
