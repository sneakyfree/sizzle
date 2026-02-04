'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth, useGpuTiers, useBalance, useFeaturedModels, useProviders } from '../../lib/hooks'
import api from '../../lib/api'

export default function Dashboard() {
  const router = useRouter()
  const { user, loading: authLoading, isAuthenticated } = useAuth()
  const { tiers, loading: tiersLoading } = useGpuTiers()
  const { balance, loading: balanceLoading } = useBalance()
  const { models, loading: modelsLoading } = useFeaturedModels()
  const { providers, loading: providersLoading } = useProviders()
  
  const [selectedTier, setSelectedTier] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [authLoading, isAuthenticated, router])
  
  const handleStartSession = async () => {
    if (!selectedTier) {
      setError('Please select a GPU tier')
      return
    }
    
    setCreating(true)
    setError(null)
    
    try {
      const session = await api.createSession(selectedTier, {
        modelId: selectedModel || undefined,
      })
      router.push(`/session/${session.sessionId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session')
    } finally {
      setCreating(false)
    }
  }
  
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-black text-white">
            💪 PUMP ME
          </Link>
          <div className="flex items-center gap-6">
            <div className="text-white/80">
              <span className="text-green-400 font-bold">${balance?.creditBalance.toFixed(2) || '0.00'}</span>
              {' '}credits
              {balance?.freeMinutesRemaining ? (
                <span className="ml-2 text-purple-400">+ {balance.freeMinutesRemaining}min free</span>
              ) : null}
            </div>
            <Link 
              href="/billing"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white text-sm font-medium transition"
            >
              Add Credits
            </Link>
            <div className="text-white/60">
              {user?.email}
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-12">
          <h1 className="text-4xl font-black text-white mb-2">
            Start Pumping 💪
          </h1>
          <p className="text-white/60 text-lg">
            Select your GPU tier and model, then hit that button!
          </p>
        </div>
        
        {/* Error Display */}
        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
            {error}
          </div>
        )}
        
        {/* GPU Tier Selection */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">1. Select GPU Tier</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {tiersLoading ? (
              <div className="col-span-full text-white/60">Loading tiers...</div>
            ) : (
              Object.entries(tiers).map(([id, tier]) => (
                <button
                  key={id}
                  onClick={() => setSelectedTier(id)}
                  className={`p-6 rounded-2xl border-2 text-left transition-all ${
                    selectedTier === id
                      ? 'border-purple-500 bg-purple-500/20'
                      : 'border-white/10 bg-white/5 hover:border-white/30'
                  }`}
                >
                  <div className="text-2xl mb-2">
                    {id === 'starter' && '🚀'}
                    {id === 'pro' && '⚡'}
                    {id === 'beast' && '🔥'}
                    {id === 'ultra' && '👑'}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">{tier.name}</h3>
                  <p className="text-white/60 text-sm mb-3">{tier.description}</p>
                  <div className="text-purple-400 font-bold">
                    ${tier.pricePerMinute.toFixed(3)}/min
                  </div>
                  <div className="text-white/40 text-xs mt-1">
                    {tier.gpuOptions[0]}
                  </div>
                </button>
              ))
            )}
          </div>
        </section>
        
        {/* Model Selection */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">2. Select Model (Optional)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <button
              onClick={() => setSelectedModel(null)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                selectedModel === null
                  ? 'border-purple-500 bg-purple-500/20'
                  : 'border-white/10 bg-white/5 hover:border-white/30'
              }`}
            >
              <h3 className="text-lg font-bold text-white">No Model</h3>
              <p className="text-white/60 text-sm">Bare GPU - bring your own stack</p>
            </button>
            
            {modelsLoading ? (
              <div className="text-white/60">Loading models...</div>
            ) : (
              models.map((model) => (
                <button
                  key={model.slug}
                  onClick={() => setSelectedModel(model.slug)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    selectedModel === model.slug
                      ? 'border-purple-500 bg-purple-500/20'
                      : 'border-white/10 bg-white/5 hover:border-white/30'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <h3 className="text-lg font-bold text-white">{model.name}</h3>
                    <span className="text-xs px-2 py-1 bg-purple-500/30 rounded text-purple-300">
                      {model.category}
                    </span>
                  </div>
                  <p className="text-white/60 text-sm mt-1">{model.description}</p>
                  <div className="text-white/40 text-xs mt-2">
                    Requires {model.minVramGb}GB VRAM
                  </div>
                </button>
              ))
            )}
          </div>
        </section>
        
        {/* Provider Status */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">Provider Status</h2>
          <div className="flex flex-wrap gap-4">
            {providersLoading ? (
              <div className="text-white/60">Loading providers...</div>
            ) : (
              providers.map((provider) => (
                <div
                  key={provider.id}
                  className={`px-4 py-2 rounded-lg ${
                    provider.isHealthy
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {provider.isHealthy ? '✓' : '✗'} {provider.name}
                  {provider.latencyMs && (
                    <span className="ml-2 text-white/40">{provider.latencyMs}ms</span>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
        
        {/* Start Button */}
        <section className="text-center">
          <button
            onClick={handleStartSession}
            disabled={creating || !selectedTier}
            className={`px-12 py-6 rounded-2xl text-2xl font-black transition-all ${
              creating || !selectedTier
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50'
            }`}
          >
            {creating ? (
              <>
                <span className="animate-spin inline-block mr-2">⏳</span>
                Provisioning...
              </>
            ) : (
              <>
                🚀 START PUMPING
              </>
            )}
          </button>
          
          {selectedTier && tiers[selectedTier] && (
            <p className="mt-4 text-white/60">
              Estimated cost: <span className="text-purple-400 font-bold">
                ${(tiers[selectedTier].pricePerMinute * 60).toFixed(2)}/hour
              </span>
            </p>
          )}
        </section>
      </main>
    </div>
  )
}
