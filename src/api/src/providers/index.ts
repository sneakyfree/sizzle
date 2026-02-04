/**
 * Provider Registry
 * 
 * Central registry for all GPU providers.
 * Handles provider discovery, health monitoring, and selection.
 */

import { GpuProvider, ProviderHealth, ProvisionRequest, ProvisionResult } from '../types/provider'
import localProvider from './local'
import vastProvider from './vast'
import runpodProvider from './runpod'

// All available providers
const providers: Map<string, GpuProvider> = new Map([
  ['local', localProvider],
  ['vast', vastProvider],
  ['runpod', runpodProvider],
])

// Provider health cache
const healthCache: Map<string, { health: ProviderHealth; timestamp: number }> = new Map()
const HEALTH_CACHE_TTL = 60000 // 1 minute

/**
 * Get all registered providers
 */
export function getAllProviders(): GpuProvider[] {
  return Array.from(providers.values())
}

/**
 * Get a specific provider by slug
 */
export function getProvider(slug: string): GpuProvider | undefined {
  return providers.get(slug)
}

/**
 * Register a new provider
 */
export function registerProvider(provider: GpuProvider): void {
  providers.set(provider.slug, provider)
  console.log(`📦 Registered provider: ${provider.name} (${provider.slug})`)
}

/**
 * Get health status for all providers
 */
export async function getProvidersHealth(): Promise<ProviderHealth[]> {
  const healthChecks = Array.from(providers.values()).map(async (provider) => {
    // Check cache
    const cached = healthCache.get(provider.slug)
    if (cached && Date.now() - cached.timestamp < HEALTH_CACHE_TTL) {
      return cached.health
    }
    
    // Perform health check
    const health = await provider.healthCheck()
    
    // Update cache
    healthCache.set(provider.slug, { health, timestamp: Date.now() })
    
    return health
  })
  
  return Promise.all(healthChecks)
}

/**
 * Find the best provider for a given request
 * Considers: price, availability, reliability, features
 */
export async function findBestProvider(request: ProvisionRequest): Promise<{
  provider: GpuProvider
  estimatedPrice: number
} | null> {
  const healthStatuses = await getProvidersHealth()
  
  // Filter healthy providers
  const healthyProviders = healthStatuses.filter(h => h.isHealthy)
  
  if (healthyProviders.length === 0) {
    console.error('No healthy providers available')
    return null
  }
  
  // Score each provider
  type ProviderScore = { provider: GpuProvider; score: number; price: number }
  const scored: ProviderScore[] = []
  
  for (const health of healthyProviders) {
    const provider = providers.get(health.provider)
    if (!provider) continue
    
    // Find cheapest matching GPU
    let cheapestPrice = Infinity
    for (const gpu of health.availableGpus) {
      // Check if GPU matches requested tier
      // (simplified - would need proper tier matching)
      if (gpu.pricePerHour < cheapestPrice) {
        cheapestPrice = gpu.pricePerHour
      }
    }
    
    if (cheapestPrice === Infinity) continue
    
    // Calculate score (lower is better)
    let score = cheapestPrice // Base: price
    
    // Bonus for local provider (fastest, most reliable)
    if (health.provider === 'local') score *= 0.8
    
    // Penalty for high latency
    score *= 1 + (health.latencyMs / 1000)
    
    // Prefer providers with preloaded model support if model requested
    if (request.modelId) {
      const caps = await provider.getCapabilities()
      if (!caps.supportsPreloadedModels) score *= 1.2
    }
    
    scored.push({ provider, score, price: cheapestPrice })
  }
  
  // Sort by score and return best
  scored.sort((a, b) => a.score - b.score)
  
  if (scored.length === 0) return null
  
  return {
    provider: scored[0].provider,
    estimatedPrice: scored[0].price,
  }
}

/**
 * Provision a GPU with automatic provider selection
 */
export async function provisionWithBestProvider(
  request: ProvisionRequest
): Promise<ProvisionResult & { provider?: string }> {
  // Try specific provider if requested
  if (request.modelId?.startsWith('provider:')) {
    const [, providerSlug] = request.modelId.split(':')
    const provider = providers.get(providerSlug)
    if (provider) {
      const result = await provider.provision(request)
      return { ...result, provider: providerSlug }
    }
  }
  
  // Find best provider
  const best = await findBestProvider(request)
  if (!best) {
    return {
      success: false,
      error: 'No available providers can fulfill this request',
    }
  }
  
  console.log(`🎯 Selected provider: ${best.provider.name} (est. $${best.estimatedPrice}/hr)`)
  
  // Provision
  const result = await best.provider.provision(request)
  return { ...result, provider: best.provider.slug }
}

// Export individual providers for direct access
export { localProvider, vastProvider, runpodProvider }

// Default export for convenience
export default {
  getAllProviders,
  getProvider,
  registerProvider,
  getProvidersHealth,
  findBestProvider,
  provisionWithBestProvider,
}
