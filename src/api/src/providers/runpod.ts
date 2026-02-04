/**
 * RunPod Provider Plugin
 * 
 * Integrates with RunPod for serverless GPU inference and pod rental.
 * RunPod offers both on-demand pods and serverless endpoints.
 * 
 * API Docs: https://docs.runpod.io/
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

const RUNPOD_API_BASE = 'https://api.runpod.io/graphql'

// RunPod GPU pricing (approximate, as of 2024)
const RUNPOD_GPU_PRICING: Record<string, number> = {
  'RTX 4090': 0.44,
  'RTX 3090': 0.22,
  'A100 80GB PCIe': 1.89,
  'A100 80GB SXM': 1.99,
  'H100 80GB': 2.99,
  'H100 NVLink': 3.29,
  'A6000': 0.76,
  'RTX A5000': 0.44,
}

interface RunPodPod {
  id: string
  name: string
  desiredStatus: 'RUNNING' | 'STOPPED' | 'TERMINATED'
  imageName: string
  machineId: string
  machine: {
    gpuDisplayName: string
  }
  runtime: {
    ports: { ip: string; publicPort: number; privatePort: number; type: string }[]
    uptimeInSeconds: number
    gpuUtilPercent: number
    memoryUtilPercent: number
  } | null
  costPerHr: string
}

export class RunPodProvider implements GpuProvider {
  readonly name = 'RunPod'
  readonly slug = 'runpod'
  
  private apiKey: string
  private enabled: boolean
  
  constructor() {
    this.apiKey = process.env.RUNPOD_API_KEY || ''
    this.enabled = process.env.RUNPOD_ENABLED === 'true' && !!this.apiKey
    
    if (!this.enabled) {
      console.log('⚠️ RunPod provider disabled (RUNPOD_API_KEY not set or RUNPOD_ENABLED=false)')
    }
  }
  
  private async graphql<T>(query: string, variables?: Record<string, any>): Promise<T> {
    const response = await fetch(RUNPOD_API_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    })
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`RunPod API error: ${response.status} - ${error}`)
    }
    
    const result = await response.json()
    if (result.errors) {
      throw new Error(`RunPod GraphQL error: ${JSON.stringify(result.errors)}`)
    }
    
    return result.data
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
      // Query available GPU types
      const data = await this.graphql<{ myself: { pods: RunPodPod[] } }>(`
        query {
          myself {
            pods {
              id
              machine { gpuDisplayName }
            }
          }
        }
      `)
      
      const latencyMs = Date.now() - startTime
      
      // Build available GPUs list from known pricing
      const availableGpus = Object.entries(RUNPOD_GPU_PRICING).map(([type, price]) => ({
        type,
        available: 100, // RunPod doesn't expose availability, assume always available
        pricePerHour: price,
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
      gpuTypes: Object.keys(RUNPOD_GPU_PRICING),
      regions: ['US-TX', 'US-CA', 'EU-RO', 'EU-NL', 'EU-SE'],
      supportsPreloadedModels: true, // RunPod templates can have models
      supportsPause: true, // Pods can be stopped
      supportsSnapshot: false,
      minPricePerHour: 0.22,
      maxPricePerHour: 3.99,
    }
  }
  
  async getAvailability(): Promise<{ type: string; available: number; pricePerHour: number; region: string }[]> {
    if (!this.enabled) return []
    
    // RunPod doesn't expose real-time availability
    // Return static data based on known GPU types
    return Object.entries(RUNPOD_GPU_PRICING).flatMap(([type, price]) => [
      { type, available: 50, pricePerHour: price, region: 'US-TX' },
      { type, available: 30, pricePerHour: price * 1.1, region: 'EU-NL' },
    ])
  }
  
  async provision(request: ProvisionRequest): Promise<ProvisionResult> {
    if (!this.enabled) {
      return { success: false, error: 'Provider disabled' }
    }
    
    try {
      const tierConfig = GPU_TIERS[request.tier]
      
      // Map tier to RunPod GPU type
      const gpuTypeMap: Record<string, string> = {
        'starter': 'RTX 4090',
        'pro': 'A100 80GB PCIe',
        'beast': 'H100 80GB',
        'ultra': 'H100 NVLink',
      }
      
      const gpuType = request.gpuType || gpuTypeMap[request.tier]
      const gpuCount = request.gpuCount || (request.tier === 'ultra' ? 8 : 1)
      
      // Determine image based on model
      let imageName = 'nvidia/cuda:12.3.1-devel-ubuntu22.04'
      if (request.modelId) {
        // Use Ollama-ready image if model specified
        imageName = 'ollama/ollama:latest'
      }
      
      // Create pod
      const data = await this.graphql<{ podFindAndDeployOnDemand: RunPodPod }>(`
        mutation {
          podFindAndDeployOnDemand(
            input: {
              name: "sizzle-${request.sessionId}"
              imageName: "${imageName}"
              gpuTypeId: "${gpuType}"
              gpuCount: ${gpuCount}
              volumeInGb: 50
              containerDiskInGb: 20
              env: [
                { key: "PUMP_SESSION_ID", value: "${request.sessionId}" }
              ]
            }
          ) {
            id
            name
            desiredStatus
            imageName
            machine { gpuDisplayName }
            costPerHr
          }
        }
      `)
      
      const pod = data.podFindAndDeployOnDemand
      
      return {
        success: true,
        instance: {
          id: pod.id,
          provider: this.slug,
          providerInstanceId: pod.id,
          gpuType: pod.machine.gpuDisplayName,
          gpuCount,
          vramGb: tierConfig.minVram,
          status: 'provisioning',
          pricePerHour: parseFloat(pod.costPerHr),
          createdAt: new Date(),
        },
        estimatedReadySeconds: 90,
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
      const data = await this.graphql<{ pod: RunPodPod }>(`
        query {
          pod(input: { podId: "${instanceId}" }) {
            id
            name
            desiredStatus
            imageName
            machine { gpuDisplayName }
            runtime {
              ports { ip publicPort privatePort type }
              uptimeInSeconds
              gpuUtilPercent
              memoryUtilPercent
            }
            costPerHr
          }
        }
      `)
      
      const pod = data.pod
      if (!pod) return null
      
      const statusMap: Record<string, GpuInstance['status']> = {
        'RUNNING': 'running',
        'STOPPED': 'stopped',
        'TERMINATED': 'stopped',
      }
      
      // Find SSH/HTTP ports
      const sshPort = pod.runtime?.ports.find(p => p.privatePort === 22)
      const httpPort = pod.runtime?.ports.find(p => p.privatePort === 8888)
      
      return {
        id: pod.id,
        provider: this.slug,
        providerInstanceId: pod.id,
        gpuType: pod.machine.gpuDisplayName,
        gpuCount: 1,
        vramGb: 0,
        status: pod.runtime ? statusMap[pod.desiredStatus] : 'provisioning',
        accessUrl: httpPort ? `http://${httpPort.ip}:${httpPort.publicPort}` : undefined,
        sshHost: sshPort?.ip,
        sshPort: sshPort?.publicPort,
        pricePerHour: parseFloat(pod.costPerHr),
        createdAt: new Date(),
        readyAt: pod.runtime ? new Date() : undefined,
      }
    } catch (error) {
      console.error('Failed to get RunPod status:', error)
      return null
    }
  }
  
  async start(instanceId: string): Promise<boolean> {
    if (!this.enabled) return false
    
    try {
      await this.graphql(`
        mutation {
          podResume(input: { podId: "${instanceId}" }) {
            id
          }
        }
      `)
      return true
    } catch (error) {
      console.error('Failed to start RunPod:', error)
      return false
    }
  }
  
  async stop(instanceId: string): Promise<boolean> {
    if (!this.enabled) return false
    
    try {
      await this.graphql(`
        mutation {
          podStop(input: { podId: "${instanceId}" }) {
            id
          }
        }
      `)
      return true
    } catch (error) {
      console.error('Failed to stop RunPod:', error)
      return false
    }
  }
  
  async terminate(instanceId: string): Promise<boolean> {
    if (!this.enabled) return false
    
    try {
      await this.graphql(`
        mutation {
          podTerminate(input: { podId: "${instanceId}" })
        }
      `)
      return true
    } catch (error) {
      console.error('Failed to terminate RunPod:', error)
      return false
    }
  }
  
  async getMetrics(instanceId: string): Promise<{
    gpuUtilization: number
    memoryUsed: number
    temperature: number
    powerDraw: number
  } | null> {
    if (!this.enabled) return null
    
    try {
      const status = await this.getStatus(instanceId)
      if (!status) return null
      
      // RunPod provides GPU/memory utilization via GraphQL
      const data = await this.graphql<{ pod: RunPodPod }>(`
        query {
          pod(input: { podId: "${instanceId}" }) {
            runtime {
              gpuUtilPercent
              memoryUtilPercent
            }
          }
        }
      `)
      
      if (!data.pod.runtime) return null
      
      return {
        gpuUtilization: data.pod.runtime.gpuUtilPercent,
        memoryUsed: data.pod.runtime.memoryUtilPercent,
        temperature: 65, // RunPod doesn't expose temperature
        powerDraw: 300, // RunPod doesn't expose power draw
      }
    } catch (error) {
      console.error('Failed to get RunPod metrics:', error)
      return null
    }
  }
}

export default new RunPodProvider()
