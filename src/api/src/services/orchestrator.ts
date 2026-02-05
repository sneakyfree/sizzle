/**
 * Provider Orchestrator
 * 
 * The brain of Sizzle's backend. Routes session requests to the best provider
 * based on availability, price, and user preferences.
 * 
 * "User Request → Sizzle Orchestrator → Provider Plugin"
 * 
 * This abstraction is why users don't know or care which backend fulfills their session.
 */

import {
  GpuProvider,
  ProvisionRequest,
  ProvisionResult,
  ProviderHealth,
  GpuInstance,
  GPU_TIERS,
  GpuTier,
} from '../types/provider';
import { localProvider } from '../providers/local';

// Registry of all available providers
const providers = new Map<string, GpuProvider>();

// Provider priority (lower = preferred)
const providerPriority: Record<string, number> = {
  local: 1, // Always prefer local (faster, no network latency)
  runpod: 2, // Good balance of price/reliability
  vast: 3, // Cheapest but less reliable
  lambda: 4, // More expensive but enterprise-grade
  coreweave: 5, // Most expensive, reserved for enterprise
};

// Initialize providers
function initProviders() {
  providers.set('local', localProvider);
  
  // TODO: Add more providers as they're implemented
  // providers.set('vast', vastProvider);
  // providers.set('runpod', runpodProvider);
  // providers.set('lambda', lambdaProvider);
  
  console.log(`🔌 Orchestrator initialized with ${providers.size} provider(s)`);
}

// Initialize on module load
initProviders();

/**
 * Get all registered providers
 */
export function getProviders(): GpuProvider[] {
  return Array.from(providers.values());
}

/**
 * Get a specific provider by slug
 */
export function getProvider(slug: string): GpuProvider | undefined {
  return providers.get(slug);
}

/**
 * Health check all providers
 */
export async function checkAllProviders(): Promise<ProviderHealth[]> {
  const checks = Array.from(providers.values()).map(p => p.healthCheck());
  return Promise.all(checks);
}

/**
 * Find the best provider for a request
 * 
 * Selection criteria:
 * 1. Has required GPU tier available
 * 2. Is healthy
 * 3. Meets price constraints
 * 4. Priority (prefer local, then cheaper providers)
 */
export async function selectBestProvider(
  request: ProvisionRequest
): Promise<GpuProvider | null> {
  const tier = GPU_TIERS[request.tier];
  if (!tier) {
    console.error(`Unknown tier: ${request.tier}`);
    return null;
  }
  
  // Get all healthy providers with availability
  const healthChecks = await checkAllProviders();
  const healthyProviders = healthChecks
    .filter(h => h.isHealthy)
    .map(h => ({
      provider: providers.get(h.provider)!,
      health: h,
      priority: providerPriority[h.provider] || 999,
    }))
    .filter(p => {
      // Check if provider has compatible GPUs available
      const hasGpu = p.health.availableGpus.some(
        gpu => (tier.gpuOptions as string[]).includes(gpu.type) && gpu.available > 0
      );
      return hasGpu;
    })
    .sort((a, b) => a.priority - b.priority);
  
  if (healthyProviders.length === 0) {
    return null;
  }
  
  // If user specified max price, filter by that
  if (request.maxPricePerHour) {
    const affordable = healthyProviders.filter(p =>
      p.health.availableGpus.some(
        gpu => gpu.pricePerHour <= request.maxPricePerHour!
      )
    );
    if (affordable.length > 0) {
      return affordable[0].provider;
    }
  }
  
  return healthyProviders[0].provider;
}

/**
 * Provision a session using the best available provider
 */
export async function provisionSession(
  request: ProvisionRequest
): Promise<ProvisionResult> {
  // Try to find the best provider
  const provider = await selectBestProvider(request);
  
  if (!provider) {
    // Try each provider in priority order as fallback
    const sortedProviders = Array.from(providers.entries())
      .sort((a, b) => (providerPriority[a[0]] || 999) - (providerPriority[b[0]] || 999));
    
    for (const [, p] of sortedProviders) {
      const result = await p.provision(request);
      if (result.success) {
        return result;
      }
    }
    
    return {
      success: false,
      error: 'No GPU capacity available. Please try again later.',
    };
  }
  
  return provider.provision(request);
}

/**
 * Get session status from any provider
 */
export async function getSessionStatus(
  sessionId: string,
  providerSlug?: string
): Promise<GpuInstance | null> {
  // If provider known, query directly
  if (providerSlug) {
    const provider = providers.get(providerSlug);
    if (provider) {
      return provider.getStatus(sessionId);
    }
  }
  
  // Otherwise, check all providers
  for (const provider of providers.values()) {
    const status = await provider.getStatus(sessionId);
    if (status) {
      return status;
    }
  }
  
  return null;
}

/**
 * Terminate a session
 */
export async function terminateSession(
  sessionId: string,
  providerSlug: string
): Promise<boolean> {
  const provider = providers.get(providerSlug);
  if (!provider) {
    return false;
  }
  return provider.terminate(sessionId);
}

/**
 * Get metrics for a session
 */
export async function getSessionMetrics(
  sessionId: string,
  providerSlug: string
) {
  const provider = providers.get(providerSlug);
  if (!provider) {
    return null;
  }
  return provider.getMetrics(sessionId);
}

/**
 * Get tier pricing across all providers
 */
export async function getTierPricing(tier: GpuTier) {
  const tierConfig = GPU_TIERS[tier];
  if (!tierConfig) return null;
  
  const healthChecks = await checkAllProviders();
  
  const pricing = healthChecks
    .filter(h => h.isHealthy)
    .flatMap(h =>
      h.availableGpus
        .filter(gpu => (tierConfig.gpuOptions as string[]).includes(gpu.type))
        .map(gpu => ({
          provider: h.provider,
          gpuType: gpu.type,
          available: gpu.available,
          pricePerHour: gpu.pricePerHour,
          pricePerMinute: gpu.pricePerHour / 60,
        }))
    )
    .sort((a, b) => a.pricePerHour - b.pricePerHour);
  
  return {
    tier,
    name: tierConfig.name,
    description: tierConfig.description,
    basePricePerMinute: tierConfig.pricePerMinute,
    providers: pricing,
    cheapest: pricing[0] || null,
  };
}

export const orchestrator = {
  getProviders,
  getProvider,
  checkAllProviders,
  selectBestProvider,
  provisionSession,
  getSessionStatus,
  terminateSession,
  getSessionMetrics,
  getTierPricing,
};
