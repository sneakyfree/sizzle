/**
 * Vast.ai Provider Plugin
 * 
 * Integrates with Vast.ai GPU marketplace for on-demand GPU rental.
 * Vast.ai offers competitive pricing and wide GPU selection.
 * 
 * API Docs: https://vast.ai/docs/
 */

import {
  GpuProvider,
  GpuInstance,
  ProvisionRequest,
  ProvisionResult,
  ProviderHealth,
  ProviderCapabilities,
  GPU_TIERS,
} from '../types/provider'

const VAST_API_BASE = 'https://console.vast.ai/api/v0'

interface VastOffer {
  id: number
  machine_id: number
  gpu_name: string
  num_gpus: number
  gpu_ram: number // in MB
  cpu_cores: number
  cpu_ram: number // in MB
  disk_space: number // in GB
  dph_total: number // dollars per hour
  dlperf: number // deep learning performance score
  inet_down: number // download speed
  inet_up: number // upload speed
  reliability: number // 0-1
  geolocation: string
  verified: boolean
  cuda_max_good: string
}

interface VastInstance {
  id: number
  machine_id: number
  actual_status: 'running' | 'loading' | 'exited' | 'error'
  intended_status: 'running' | 'stopped'
  ssh_host: string
  ssh_port: number
  jupyter_url?: string
  start_date: number // unix timestamp
  gpu_name: string
  num_gpus: number
  dph_total: number
}

export class VastProvider implements GpuProvider {
  readonly name = 'Vast.ai'
  readonly slug = 'vast'
  
  private apiKey: string
  private enabled: boolean
  
  constructor() {
    this.apiKey = process.env.VAST_API_KEY || ''
    this.enabled = process.env.VAST_ENABLED === 'true' && !!this.apiKey
    
    if (!this.enabled) {
      console.log('⚠️ Vast.ai provider disabled (VAST_API_KEY not set or VAST_ENABLED=false)')
    }
  }
  
  private async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${VAST_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Vast.ai API error: ${response.status} - ${error}`)
    }
    
    return response.json()
  }
  
  async healthCheck(): Promise<ProviderHealth> {
    const startTime = Date.now()
    
    if (!this.enabled) {
      return {
        provider: this.slug,
        isHealthy: false,
        latencyMs: 0,
        lastCheck: new Date(),
        availableGpus: [],
        error: 'Provider disabled',
      }
    }
    
    try {
      // Get available offers to check API health
      const offers = await this.fetch<{ offers: VastOffer[] }>('/bundles?q={}')
      const latencyMs = Date.now() - startTime
      
      // Aggregate available GPUs
      const gpuMap = new Map<string, { available: number; minPrice: number }>()
      for (const offer of offers.offers.slice(0, 100)) {
        const key = offer.gpu_name
        const existing = gpuMap.get(key)
        const hourlyRate = offer.dph_total
        
        if (existing) {
          existing.available += offer.num_gpus
          existing.minPrice = Math.min(existing.minPrice, hourlyRate)
        } else {
          gpuMap.set(key, { available: offer.num_gpus, minPrice: hourlyRate })
        }
      }
      
      const availableGpus = Array.from(gpuMap.entries()).map(([type, data]) => ({
        type,
        available: data.available,
        pricePerHour: data.minPrice,
      }))
      
      return {
        provider: this.slug,
        isHealthy: true,
        latencyMs,
        lastCheck: new Date(),
        availableGpus,
      }
    } catch (error) {
      return {
        provider: this.slug,
        isHealthy: false,
        latencyMs: Date.now() - startTime,
        lastCheck: new Date(),
        availableGpus: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
  
  async getCapabilities(): Promise<ProviderCapabilities> {
    return {
      provider: this.slug,
      name: this.name,
      gpuTypes: [
        'RTX 4090', 'RTX 3090', 'RTX 3080', 
        'A100 40GB', 'A100 80GB', 
        'H100 80GB', 'H100 NVLink',
        'A6000', 'A5000', 'A4000',
      ],
      regions: ['US', 'EU', 'ASIA'],
      supportsPreloadedModels: false, // User must download after provisioning
      supportsPause: false, // Vast doesn't support pause
      supportsSnapshot: false,
      minPricePerHour: 0.10,
      maxPricePerHour: 10.00,
    }
  }
  
  async getAvailability(): Promise<{ type: string; available: number; pricePerHour: number; region: string }[]> {
    if (!this.enabled) return []
    
    try {
      const offers = await this.fetch<{ offers: VastOffer[] }>('/bundles?q={}')
      
      // Group by GPU type and region
      const availability: { type: string; available: number; pricePerHour: number; region: string }[] = []
      const seen = new Set<string>()
      
      for (const offer of offers.offers.slice(0, 200)) {
        const key = `${offer.gpu_name}-${offer.geolocation}`
        if (seen.has(key)) continue
        seen.add(key)
        
        availability.push({
          type: offer.gpu_name,
          available: offer.num_gpus,
          pricePerHour: offer.dph_total,
          region: offer.geolocation,
        })
      }
      
      return availability
    } catch (error) {
      console.error('Failed to get Vast.ai availability:', error)
      return []
    }
  }
  
  async provision(request: ProvisionRequest): Promise<ProvisionResult> {
    if (!this.enabled) {
      return { success: false, error: 'Provider disabled' }
    }
    
    try {
      // Find best offer matching the tier
      const tierConfig = GPU_TIERS[request.tier]
      const gpuOptions = tierConfig.gpuOptions
      
      // Search for matching offers
      const searchQuery = {
        verified: { eq: true },
        rentable: { eq: true },
        num_gpus: { gte: request.gpuCount || 1 },
        gpu_ram: { gte: tierConfig.minVram * 1024 }, // Convert GB to MB
        reliability: { gte: 0.95 },
        order: [['dph_total', 'asc']], // Sort by price
      }
      
      const searchResponse = await this.fetch<{ offers: VastOffer[] }>(
        `/bundles?q=${encodeURIComponent(JSON.stringify(searchQuery))}`
      )
      
      // Find offer with matching GPU type
      const matchingOffer = searchResponse.offers.find(offer => 
        gpuOptions.some(gpu => offer.gpu_name.toLowerCase().includes(gpu.toLowerCase()))
      )
      
      if (!matchingOffer) {
        return {
          success: false,
          error: `No available GPUs matching tier "${request.tier}"`,
        }
      }
      
      // Create the instance
      const createResponse = await this.fetch<{ new_contract: number }>('/asks/', {
        method: 'PUT',
        body: JSON.stringify({
          client_id: 'sizzle',
          image: 'nvidia/cuda:12.3.1-devel-ubuntu22.04', // Default CUDA image
          disk: 50, // GB
          runtype: 'args',
          args: [],
          env: {},
          onstart: null,
          label: `sizzle-${request.sessionId}`,
          extra: { sessionId: request.sessionId },
        }),
      })
      
      // Get instance details
      const instance = await this.getStatus(createResponse.new_contract.toString())
      
      if (!instance) {
        return { success: false, error: 'Failed to get instance status after creation' }
      }
      
      return {
        success: true,
        instance,
        estimatedReadySeconds: 60,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Provisioning failed',
      }
    }
  }
  
  async getStatus(instanceId: string): Promise<GpuInstance | null> {
    if (!this.enabled) return null
    
    try {
      const instances = await this.fetch<{ instances: VastInstance[] }>('/instances/')
      const instance = instances.instances.find(i => i.id.toString() === instanceId)
      
      if (!instance) return null
      
      const statusMap: Record<string, GpuInstance['status']> = {
        'running': 'running',
        'loading': 'provisioning',
        'exited': 'stopped',
        'error': 'error',
      }
      
      return {
        id: instance.id.toString(),
        provider: this.slug,
        providerInstanceId: instance.id.toString(),
        gpuType: instance.gpu_name,
        gpuCount: instance.num_gpus,
        vramGb: 0, // Would need to fetch from offer data
        status: statusMap[instance.actual_status] || 'pending',
        accessUrl: instance.jupyter_url,
        sshHost: instance.ssh_host,
        sshPort: instance.ssh_port,
        pricePerHour: instance.dph_total,
        createdAt: new Date(instance.start_date * 1000),
        readyAt: instance.actual_status === 'running' ? new Date() : undefined,
      }
    } catch (error) {
      console.error('Failed to get Vast.ai instance status:', error)
      return null
    }
  }
  
  async start(instanceId: string): Promise<boolean> {
    if (!this.enabled) return false
    
    try {
      await this.fetch(`/instances/${instanceId}/`, {
        method: 'PUT',
        body: JSON.stringify({ state: 'running' }),
      })
      return true
    } catch (error) {
      console.error('Failed to start Vast.ai instance:', error)
      return false
    }
  }
  
  async stop(instanceId: string): Promise<boolean> {
    if (!this.enabled) return false
    
    try {
      await this.fetch(`/instances/${instanceId}/`, {
        method: 'PUT',
        body: JSON.stringify({ state: 'stopped' }),
      })
      return true
    } catch (error) {
      console.error('Failed to stop Vast.ai instance:', error)
      return false
    }
  }
  
  async terminate(instanceId: string): Promise<boolean> {
    if (!this.enabled) return false
    
    try {
      await this.fetch(`/instances/${instanceId}/`, {
        method: 'DELETE',
      })
      return true
    } catch (error) {
      console.error('Failed to terminate Vast.ai instance:', error)
      return false
    }
  }
  
  async getMetrics(instanceId: string): Promise<{
    gpuUtilization: number
    memoryUsed: number
    temperature: number
    powerDraw: number
  } | null> {
    // Vast.ai doesn't provide real-time metrics via API
    // Would need to SSH into instance and run nvidia-smi
    return null
  }
}

export default new VastProvider()
