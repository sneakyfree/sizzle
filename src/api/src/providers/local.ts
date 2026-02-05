/**
 * Local Provider - Veron 1 (RTX 5090)
 * 
 * This provider manages local GPU resources.
 * First node in the Sizzle fleet.
 * 
 * Ollama is already running on this machine.
 */

import {
  GpuProvider,
  GpuInstance,
  ProvisionRequest,
  ProvisionResult,
  ProviderHealth,
  ProviderCapabilities,
} from '../types/provider';

// Track active sessions on local GPU
const activeSessions = new Map<string, GpuInstance>();

export class LocalProvider implements GpuProvider {
  readonly name = 'Veron 1 Local';
  readonly slug = 'local';
  
  private readonly baseUrl = process.env.LOCAL_OLLAMA_URL || 'http://localhost:11434';
  
  async healthCheck(): Promise<ProviderHealth> {
    const start = Date.now();
    
    try {
      // Check if Ollama is responding
      const response: any = await fetch(`${this.baseUrl}/api/tags`);
      const latencyMs = Date.now() - start;
      
      if (!response.ok) {
        return {
          provider: this.slug,
          isHealthy: false,
          latencyMs,
          lastCheck: new Date(),
          availableGpus: [],
          error: `Ollama responded with ${response.status}`,
        };
      }
      
      // Check available models
      const data = await response.json();
      const modelCount = data?.models?.length || 0;
      
      return {
        provider: this.slug,
        isHealthy: true,
        latencyMs,
        lastCheck: new Date(),
        availableGpus: [
          {
            type: 'RTX 5090',
            available: activeSessions.size === 0 ? 1 : 0,
            pricePerHour: 9.0, // $0.15/min
          },
        ],
      };
    } catch (error) {
      return {
        provider: this.slug,
        isHealthy: false,
        latencyMs: Date.now() - start,
        lastCheck: new Date(),
        availableGpus: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  async getCapabilities(): Promise<ProviderCapabilities> {
    return {
      provider: this.slug,
      name: this.name,
      gpuTypes: ['RTX 5090'],
      regions: ['local'],
      supportsPreloadedModels: true,
      supportsPause: false, // Local doesn't pause, just runs
      supportsSnapshot: false,
      minPricePerHour: 9.0,
      maxPricePerHour: 9.0,
    };
  }
  
  async getAvailability() {
    return [
      {
        type: 'RTX 5090',
        available: activeSessions.size === 0 ? 1 : 0,
        pricePerHour: 9.0,
        region: 'local',
      },
    ];
  }
  
  async provision(request: ProvisionRequest): Promise<ProvisionResult> {
    // Check if GPU is available
    if (activeSessions.size > 0) {
      return {
        success: false,
        error: 'Local GPU is currently in use. Try another provider.',
      };
    }
    
    // Check tier compatibility
    if (request.tier !== 'starter') {
      return {
        success: false,
        error: `Local provider only supports 'starter' tier. Requested: ${request.tier}`,
      };
    }
    
    const instance: GpuInstance = {
      id: request.sessionId,
      provider: this.slug,
      providerInstanceId: `local_${request.sessionId}`,
      gpuType: 'RTX 5090',
      gpuCount: 1,
      vramGb: 32,
      status: 'running',
      accessUrl: this.baseUrl,
      pricePerHour: 9.0,
      createdAt: new Date(),
      readyAt: new Date(), // Local is instant
      region: 'local',
      metadata: {
        modelId: request.modelId,
      },
    };
    
    activeSessions.set(request.sessionId, instance);
    
    // If model requested, ensure it's loaded
    if (request.modelId) {
      try {
        await this.preloadModel(request.modelId);
      } catch (error) {
        console.error('Failed to preload model:', error);
        // Don't fail the session, model can be loaded later
      }
    }
    
    return {
      success: true,
      instance,
      estimatedReadySeconds: 0,
    };
  }
  
  async getStatus(instanceId: string): Promise<GpuInstance | null> {
    return activeSessions.get(instanceId) || null;
  }
  
  async start(instanceId: string): Promise<boolean> {
    const instance = activeSessions.get(instanceId);
    if (instance) {
      instance.status = 'running';
      return true;
    }
    return false;
  }
  
  async stop(instanceId: string): Promise<boolean> {
    const instance = activeSessions.get(instanceId);
    if (instance) {
      instance.status = 'stopped';
      return true;
    }
    return false;
  }
  
  async terminate(instanceId: string): Promise<boolean> {
    return activeSessions.delete(instanceId);
  }
  
  async getMetrics(instanceId: string) {
    const instance = activeSessions.get(instanceId);
    if (!instance) return null;
    
    // TODO: Get actual metrics from nvidia-smi
    return {
      gpuUtilization: Math.random() * 30 + 60, // Simulated 60-90%
      memoryUsed: Math.random() * 20 + 50, // Simulated 50-70%
      temperature: Math.random() * 10 + 60, // Simulated 60-70°C
      powerDraw: Math.random() * 50 + 300, // Simulated 300-350W
    };
  }
  
  /**
   * Preload a model into Ollama
   */
  private async preloadModel(modelId: string): Promise<void> {
    // Map model IDs to Ollama model names
    const modelMap: Record<string, string> = {
      'llama-3-8b': 'llama3:8b',
      'llama-3-70b': 'llama3:70b',
      'mistral-7b': 'mistral:7b',
      'codellama-34b': 'codellama:34b',
      'deepseek-coder': 'deepseek-coder:33b',
      'qwen-72b': 'qwen:72b',
    };
    
    const ollamaModel = modelMap[modelId] || modelId;
    
    // Pull model if not exists (this is async and may take a while)
    const response: any = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: ollamaModel }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to pull model: ${response.statusText}`);
    }
  }
  
  /**
   * List available models on Ollama
   */
  async listModels(): Promise<string[]> {
    try {
      const response: any = await fetch(`${this.baseUrl}/api/tags`);
      const data = await response.json();
      return data?.models?.map((m: { name: string }) => m.name) || [];
    } catch {
      return [];
    }
  }
}

// Export singleton instance
export const localProvider = new LocalProvider();
