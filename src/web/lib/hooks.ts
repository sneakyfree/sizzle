'use client'

/**
 * Sizzle React Hooks
 * 
 * Custom hooks for data fetching and state management.
 */

import { useState, useEffect, useCallback } from 'react'
import api, { User, Session, GpuTier, Model, CreditPackage } from './api'

// ==================
// AUTH HOOKS
// ==================

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const loadUser = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const { user } = await api.getCurrentUser()
      setUser(user)
    } catch (err) {
      setUser(null)
      // Don't set error for 401 - that's just not logged in
      if (err instanceof Error && !err.message.includes('401')) {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }, [])
  
  useEffect(() => {
    if (api.getAuthToken()) {
      loadUser()
    } else {
      setLoading(false)
    }
  }, [loadUser])
  
  const login = async (email: string, password: string) => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.login(email, password)
      setUser(result.user)
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
      throw err
    } finally {
      setLoading(false)
    }
  }
  
  const register = async (email: string, password: string, name?: string) => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.register(email, password, name)
      setUser(result.user)
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
      throw err
    } finally {
      setLoading(false)
    }
  }
  
  const logout = async () => {
    await api.logout()
    setUser(null)
  }
  
  return {
    user,
    loading,
    error,
    login,
    register,
    logout,
    refresh: loadUser,
    isAuthenticated: !!user,
  }
}

// ==================
// SESSION HOOKS
// ==================

export function useGpuTiers() {
  const [tiers, setTiers] = useState<Record<string, GpuTier>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    async function load() {
      try {
        const { tiers } = await api.getGpuTiers()
        setTiers(tiers)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tiers')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])
  
  return { tiers, loading, error }
}

export function useSession(sessionId: string | null) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const refresh = useCallback(async () => {
    if (!sessionId) {
      setSession(null)
      setLoading(false)
      return
    }
    
    try {
      const data = await api.getSession(sessionId)
      setSession(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session')
    } finally {
      setLoading(false)
    }
  }, [sessionId])
  
  useEffect(() => {
    refresh()
    
    // Poll for updates when session is running
    if (sessionId) {
      const interval = setInterval(refresh, 5000)
      return () => clearInterval(interval)
    }
  }, [sessionId, refresh])
  
  const stop = async () => {
    if (!sessionId) return
    setLoading(true)
    try {
      const result = await api.stopSession(sessionId)
      await refresh()
      return result
    } finally {
      setLoading(false)
    }
  }
  
  return { session, loading, error, refresh, stop }
}

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const load = useCallback(async (options?: { status?: string; limit?: number; offset?: number }) => {
    try {
      setLoading(true)
      const { sessions, total } = await api.listSessions(options)
      setSessions(sessions)
      setTotal(total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }, [])
  
  useEffect(() => {
    load()
  }, [load])
  
  return { sessions, total, loading, error, refresh: load }
}

// ==================
// BILLING HOOKS
// ==================

export function useBalance() {
  const [balance, setBalance] = useState<{
    creditBalance: number
    freeMinutesRemaining: number
    tier: string
    hasSubscription: boolean
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.getBalance()
      setBalance(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load balance')
    } finally {
      setLoading(false)
    }
  }, [])
  
  useEffect(() => {
    refresh()
  }, [refresh])
  
  return { balance, loading, error, refresh }
}

export function useCreditPackages() {
  const [packages, setPackages] = useState<CreditPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    async function load() {
      try {
        const { packages } = await api.getCreditPackages()
        setPackages(packages)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load packages')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])
  
  return { packages, loading, error }
}

// ==================
// MODELS HOOKS
// ==================

export function useModels(options?: { category?: string; featured?: boolean; search?: string }) {
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const { models } = await api.getModels(options)
        setModels(models)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load models')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [options?.category, options?.featured, options?.search])
  
  return { models, loading, error }
}

export function useFeaturedModels() {
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    async function load() {
      try {
        const { models } = await api.getFeaturedModels()
        setModels(models)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load models')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])
  
  return { models, loading, error }
}

export function useModel(slug: string | null) {
  const [model, setModel] = useState<Model | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    async function load() {
      if (!slug) {
        setModel(null)
        setLoading(false)
        return
      }
      
      try {
        setLoading(true)
        const { model } = await api.getModel(slug)
        setModel(model)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load model')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [slug])
  
  return { model, loading, error }
}

// ==================
// PROVIDERS HOOKS
// ==================

export function useProviders() {
  const [providers, setProviders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const { providers } = await api.getProviders()
      setProviders(providers)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load providers')
    } finally {
      setLoading(false)
    }
  }, [])
  
  useEffect(() => {
    refresh()
  }, [refresh])
  
  return { providers, loading, error, refresh }
}

// Default export
export default {
  useAuth,
  useGpuTiers,
  useSession,
  useSessions,
  useBalance,
  useCreditPackages,
  useModels,
  useFeaturedModels,
  useModel,
  useProviders,
}
