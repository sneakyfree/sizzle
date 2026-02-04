/**
 * Sizzle - Provider Plugin Interface
 * 
 * This is the core abstraction that lets us swap GPU backends.
 * Each provider (Vast, RunPod, Lambda, Local) implements this interface.
 * 
 * "Provider = plugin" architecture — future-proofs backend swaps.
 * Users don't know or care which provider fulfills their session.
 */

export interface GpuInstance {
  id: string;
  provider: string;
  providerInstanceId: string;
  
  // GPU specs
  gpuType: string;
  gpuCount: number;
  vramGb: number;
  
  // Status
  status: 'pending' | 'provisioning' | 'running' | 'stopped' | 'error';
  
  // Access
  accessUrl?: string;
  sshHost?: string;
  sshPort?: number;
  
  // Pricing
  pricePerHour: number; // In dollars
  
  // Timing
  createdAt: Date;
  readyAt?: Date;
  
  // Metadata
  region?: string;
  metadata?: Record<string, unknown>;
}

export interface ProvisionRequest {
  // What user wants
  tier: 'starter' | 'pro' | 'beast' | 'ultra';
  gpuType?: string; // Optional specific GPU
  gpuCount?: number;
  
  // Optional model to preload
  modelId?: string;
  
  // Configuration
  region?: string;
  maxWaitTimeSeconds?: number;
  
  // Budget
  maxPricePerHour?: number;
  
  // Session info
  sessionId: string;
  userId: string;
}

export interface ProvisionResult {
  success: boolean;
  instance?: GpuInstance;
  error?: string;
  estimatedReadySeconds?: number;
}

export interface ProviderHealth {
  provider: string;
  isHealthy: boolean;
  latencyMs: number;
  lastCheck: Date;
  availableGpus: {
    type: string;
    available: number;
    pricePerHour: number;
  }[];
  error?: string;
}

export interface ProviderCapabilities {
  provider: string;
  name: string;
  
  // What GPUs are supported
  gpuTypes: string[];
  
  // What regions
  regions: string[];
  
  // Features
  supportsPreloadedModels: boolean;
  supportsPause: boolean;
  supportsSnapshot: boolean;
  
  // Pricing range
  minPricePerHour: number;
  maxPricePerHour: number;
}

/**
 * Provider Plugin Interface
 * 
 * Every GPU backend must implement this interface.
 * This is the contract that makes providers interchangeable.
 */
export interface GpuProvider {
  // Identity
  readonly name: string;
  readonly slug: string;
  
  /**
   * Check if provider is healthy and responsive
   */
  healthCheck(): Promise<ProviderHealth>;
  
  /**
   * Get provider capabilities
   */
  getCapabilities(): Promise<ProviderCapabilities>;
  
  /**
   * Get available GPUs and their current pricing
   */
  getAvailability(): Promise<{
    type: string;
    available: number;
    pricePerHour: number;
    region: string;
  }[]>;
  
  /**
   * Provision a new GPU instance
   */
  provision(request: ProvisionRequest): Promise<ProvisionResult>;
  
  /**
   * Get instance status
   */
  getStatus(instanceId: string): Promise<GpuInstance | null>;
  
  /**
   * Start a stopped instance
   */
  start(instanceId: string): Promise<boolean>;
  
  /**
   * Stop (pause) an instance - keeps data
   */
  stop(instanceId: string): Promise<boolean>;
  
  /**
   * Terminate an instance - destroys everything
   */
  terminate(instanceId: string): Promise<boolean>;
  
  /**
   * Get metrics for an instance
   */
  getMetrics(instanceId: string): Promise<{
    gpuUtilization: number;
    memoryUsed: number;
    temperature: number;
    powerDraw: number;
  } | null>;
}

/**
 * GPU Tier Definitions
 * 
 * These map user-friendly tiers to specific GPU configurations.
 */
export const GPU_TIERS = {
  starter: {
    name: 'Starter',
    description: 'Great for learning and small projects',
    gpuOptions: ['RTX 4090', 'RTX 5090'],
    minVram: 24,
    pricePerMinute: 0.15, // $9/hour
  },
  pro: {
    name: 'Pro',
    description: 'Production workloads and medium training',
    gpuOptions: ['A100 40GB', 'A100 80GB'],
    minVram: 40,
    pricePerMinute: 0.45, // $27/hour
  },
  beast: {
    name: 'Beast Mode',
    description: 'Maximum performance for serious work',
    gpuOptions: ['H100 80GB', '8x H100 NVLink'],
    minVram: 80,
    pricePerMinute: 1.50, // $90/hour
  },
  ultra: {
    name: 'Ultra Beast',
    description: 'Render an Oscar-winning film in hours',
    gpuOptions: ['8x B300', '16x B300'],
    minVram: 192,
    pricePerMinute: 4.00, // $240/hour
  },
} as const;

export type GpuTier = keyof typeof GPU_TIERS;
