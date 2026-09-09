export type RegionCode =
  | 'us-east-1'
  | 'us-west-2'
  | 'eu-central-1'
  | 'eu-west-1'
  | 'ap-south-1'
  | 'ap-south-2'
  | 'ap-southeast-1'
  | 'ap-northeast-1'
  | 'sa-east-1'
  | 'global-anycast';

export type EndpointStatus = 'healthy' | 'degraded' | 'rate-limited' | 'offline';

export type RoutingPolicy =
  | 'weighted-round-robin'
  | 'lowest-latency'
  | 'regional-geo'
  | 'failover-cascade'
  | 'cost-optimized';

export interface Endpoint {
  id: string;
  providerId: string;
  name: string;
  region: RegionCode;
  regionLabel: string;
  apiKey: string;
  baseUrl: string;
  weight: number; // 1 - 100
  priorityTier: number; // 1 = Primary, 2 = Secondary, 3 = Cold Backup
  status: EndpointStatus;
  latencyMs: number;
  uptimePercentage: number;
  rateLimitRpm: number;
  rateLimitRemaining: number;
  totalRouted: number;
  errorsCount: number;
  enabled: boolean;
  lastChecked: number;
}

export interface Provider {
  id: string;
  name: string;
  slug: string;
  category: 'LLM & Multimodal' | 'Speech & Audio' | 'Embedding & Search' | 'Custom API';
  defaultBaseUrl: string;
  models: string[];
  dailyTokenQuota?: string;
  isCustom?: boolean;
}

export interface RoutingDecision {
  id: string;
  timestamp: number;
  providerId: string;
  providerName: string;
  selectedEndpointId: string;
  selectedEndpointName: string;
  selectedRegion: string;
  policyApplied: RoutingPolicy;
  latencyMs: number;
  statusCode: number;
  cached: boolean;
  failoverAttempted: boolean;
  failoverReason?: string;
  crossProviderFailover?: boolean;
  initialProviderName?: string;
  fallbackChain?: string[];
  promptSummary: string;
  responsePayload: string;
  tokensUsed: number;
  isLive?: boolean;
}

export interface WatchdogEvent {
  id: string;
  timestamp: number;
  type: 'heal' | 'failover' | 'quota_alert' | 'route_optimize' | 'ping_sweep';
  title: string;
  description: string;
  actionTaken: string;
  affectedProvider?: string;
  affectedEndpoint?: string;
  latencyBefore?: number;
  latencyAfter?: number;
}

export interface ProviderDailyUsage {
  providerId: string;
  requestsUsed: number;
  requestsLimit: number;
  tokensUsed: number;
  tokensLimit: number;
  primaryUnit: 'requests' | 'tokens';
  lastUpdated: number;
}

export interface UniversalProxyConfig {
  baseUrl: string;
  defaultModel: string;
  crossProviderFallback: boolean;
  activeChain: string[];
}

export interface EdgeMetrics {
  requestsPerSec: number;
  p95LatencyMs: number;
  uptimePercent: number;
  totalRequests: number;
  cacheHitRate: number;
  activeEndpoints: number;
  totalEndpoints: number;
}

export interface GeneratedApiKey {
  id: string;
  key: string;
  name: string;
  createdAt: number;
  lastUsed?: number;
  permissions: 'all-models' | 'read-only';
}
