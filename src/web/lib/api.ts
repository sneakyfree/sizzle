/**
 * Sizzle API Client
 * 
 * Type-safe API client for the Sizzle backend.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

// Types
export interface User {
  id: string
  email: string
  name?: string
  tier: 'FREE' | 'PUMP_VPN' | 'PUMP_HOME' | 'ENTERPRISE'
  creditBalance: number
  freeMinutesRemaining: number
}

export interface Session {
  sessionId: string
  status: 'pending' | 'provisioning' | 'running' | 'paused' | 'terminated' | 'error'
  tier: string
  gpu: string
  gpuCount: number
  provider: string
  modelId?: string
  modelName?: string
  pricePerMinute: number
  startedAt?: string
  runningMinutes?: number
  currentCost?: number
  accessUrl?: string
  sshHost?: string
  sshPort?: number
  metrics?: {
    gpuUtilization: number
    memoryUsed: number
    temperature: number
    powerDraw: number
  }
}

export interface GpuTier {
  name: string
  description: string
  gpuOptions: string[]
  pricePerMinute: number
  pricePerHour: number
}

export interface Model {
  slug: string
  name: string
  description: string
  category: string
  minVramGb: number
  recommendedGpu: string[]
  isFeatured: boolean
}

export interface CreditPackage {
  id: string
  name: string
  credits: number
  bonusCredits: number
  totalCredits: number
  price: number
  priceFormatted: string
  valuePerCredit: string
}

// Auth storage
let authToken: string | null = null

if (typeof window !== 'undefined') {
  authToken = localStorage.getItem('pump_token')
}

export function setAuthToken(token: string | null) {
  authToken = token
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('pump_token', token)
    } else {
      localStorage.removeItem('pump_token')
    }
  }
}

export function getAuthToken(): string | null {
  return authToken
}

// API Request helper
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  
  if (authToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${authToken}`
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  })
  
  const data = await response.json()
  
  if (!response.ok) {
    throw new Error(data.error || data.message || 'Request failed')
  }
  
  return data
}

// ==================
// AUTH API
// ==================

export async function register(email: string, password: string, name?: string): Promise<{ token: string; user: User }> {
  const result = await request<{ token: string; user: User }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  })
  setAuthToken(result.token)
  return result
}

export async function login(email: string, password: string): Promise<{ token: string; user: User }> {
  const result = await request<{ token: string; user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  setAuthToken(result.token)
  return result
}

export async function logout(): Promise<void> {
  await request('/auth/logout', { method: 'POST' })
  setAuthToken(null)
}

export async function getCurrentUser(): Promise<{ user: User }> {
  return request<{ user: User }>('/auth/me')
}

// ==================
// SESSIONS API
// ==================

export async function getGpuTiers(): Promise<{ tiers: Record<string, GpuTier> }> {
  return request<{ tiers: Record<string, GpuTier> }>('/sessions/tiers')
}

export async function getProviders(): Promise<{ providers: any[] }> {
  return request<{ providers: any[] }>('/sessions/providers')
}

export async function createSession(
  tier: string,
  options?: { modelId?: string; modelName?: string; duration?: number; provider?: string }
): Promise<Session> {
  return request<Session>('/sessions/create', {
    method: 'POST',
    body: JSON.stringify({ tier, ...options }),
  })
}

export async function getSession(sessionId: string): Promise<Session> {
  return request<Session>(`/sessions/${sessionId}`)
}

export async function stopSession(sessionId: string): Promise<{ totalMinutes: number; totalCost: number }> {
  return request<{ totalMinutes: number; totalCost: number }>(`/sessions/${sessionId}/stop`, {
    method: 'POST',
  })
}

export async function listSessions(options?: { status?: string; limit?: number; offset?: number }): Promise<{ sessions: Session[]; total: number }> {
  const params = new URLSearchParams()
  if (options?.status) params.set('status', options.status)
  if (options?.limit) params.set('limit', options.limit.toString())
  if (options?.offset) params.set('offset', options.offset.toString())
  
  return request<{ sessions: Session[]; total: number }>(`/sessions?${params}`)
}

export async function getSessionMetrics(sessionId: string): Promise<{ metrics: Session['metrics'] }> {
  return request<{ metrics: Session['metrics'] }>(`/sessions/${sessionId}/metrics`)
}

// ==================
// BILLING API
// ==================

export async function getCreditPackages(): Promise<{ packages: CreditPackage[] }> {
  return request<{ packages: CreditPackage[] }>('/billing/packages')
}

export async function getSubscriptionTiers(): Promise<{ tiers: any[] }> {
  return request<{ tiers: any[] }>('/billing/subscriptions')
}

export async function getBalance(): Promise<{
  creditBalance: number
  freeMinutesRemaining: number
  tier: string
  hasSubscription: boolean
}> {
  return request<any>('/billing/balance')
}

export async function createCreditCheckout(packageId: string): Promise<{ checkoutUrl: string }> {
  return request<{ checkoutUrl: string }>('/billing/checkout/credits', {
    method: 'POST',
    body: JSON.stringify({ packageId }),
  })
}

export async function createSubscriptionCheckout(tierId: string): Promise<{ checkoutUrl: string }> {
  return request<{ checkoutUrl: string }>('/billing/checkout/subscription', {
    method: 'POST',
    body: JSON.stringify({ tierId }),
  })
}

export async function cancelSubscription(): Promise<{ message: string }> {
  return request<{ message: string }>('/billing/subscription/cancel', {
    method: 'POST',
  })
}

export async function getBillingPortal(): Promise<{ portalUrl: string }> {
  return request<{ portalUrl: string }>('/billing/portal')
}

export async function getInvoices(options?: { limit?: number; offset?: number }): Promise<{ invoices: any[]; total: number }> {
  const params = new URLSearchParams()
  if (options?.limit) params.set('limit', options.limit.toString())
  if (options?.offset) params.set('offset', options.offset.toString())
  
  return request<{ invoices: any[]; total: number }>(`/billing/invoices?${params}`)
}

// ==================
// MODELS API
// ==================

export async function getModels(options?: { category?: string; featured?: boolean; minVram?: number; search?: string }): Promise<{ models: Model[]; total: number }> {
  const params = new URLSearchParams()
  if (options?.category) params.set('category', options.category)
  if (options?.featured) params.set('featured', 'true')
  if (options?.minVram) params.set('minVram', options.minVram.toString())
  if (options?.search) params.set('search', options.search)
  
  return request<{ models: Model[]; total: number }>(`/models?${params}`)
}

export async function getFeaturedModels(): Promise<{ models: Model[] }> {
  return request<{ models: Model[] }>('/models/featured')
}

export async function getModelCategories(): Promise<{ categories: { id: string; name: string; description: string }[] }> {
  return request<{ categories: any[] }>('/models/categories')
}

export async function getModel(slug: string): Promise<{ model: Model }> {
  return request<{ model: Model }>(`/models/${slug}`)
}

export async function getModelCompatibleTiers(slug: string): Promise<{ tiers: { id: string; compatible: boolean; reason?: string }[] }> {
  return request<{ tiers: any[] }>(`/models/${slug}/compatible-tiers`)
}

// ==================
// HEALTH API
// ==================

export async function checkHealth(): Promise<{ status: string }> {
  return request<{ status: string }>('/health')
}

export async function getSystemStats(): Promise<{ stats: any }> {
  return request<{ stats: any }>('/health/stats')
}

// Default export
export default {
  // Auth
  register,
  login,
  logout,
  getCurrentUser,
  setAuthToken,
  getAuthToken,
  
  // Sessions
  getGpuTiers,
  getProviders,
  createSession,
  getSession,
  stopSession,
  listSessions,
  getSessionMetrics,
  
  // Billing
  getCreditPackages,
  getSubscriptionTiers,
  getBalance,
  createCreditCheckout,
  createSubscriptionCheckout,
  cancelSubscription,
  getBillingPortal,
  getInvoices,
  
  // Models
  getModels,
  getFeaturedModels,
  getModelCategories,
  getModel,
  getModelCompatibleTiers,
  
  // Health
  checkHealth,
  getSystemStats,
}
