'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useModels, useAuth } from '../../lib/hooks'
import api from '../../lib/api'

export default function ModelsPage() {
  const { isAuthenticated } = useAuth()
  const [category, setCategory] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [categories, setCategories] = useState<{ id: string; name: string; description: string }[]>([])
  
  const { models, loading, error } = useModels({ 
    category: category || undefined, 
    search: search || undefined 
  })
  
  // Load categories
  useEffect(() => {
    api.getModelCategories().then(data => setCategories(data.categories))
  }, [])
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-black text-white">
            💪 PUMP ME
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-white/60 hover:text-white">
              Dashboard
            </Link>
            {!isAuthenticated && (
              <Link 
                href="/login"
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white text-sm font-medium transition"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-12">
          <h1 className="text-4xl font-black text-white mb-2">
            Model Library 🧠
          </h1>
          <p className="text-white/60 text-lg">
            Browse AI models ready to run on your GPU session
          </p>
        </div>
        
        {/* Search & Filters */}
        <div className="mb-8 flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search models..."
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
            />
          </div>
          
          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCategory(null)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                !category
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/5 text-white/60 hover:text-white'
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  category === cat.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-white/5 text-white/60 hover:text-white'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
        
        {/* Error */}
        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
            {error}
          </div>
        )}
        
        {/* Models Grid */}
        {loading ? (
          <div className="text-white/60 text-center py-12">Loading models...</div>
        ) : models.length === 0 ? (
          <div className="text-white/60 text-center py-12">
            No models found. Try a different search or category.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {models.map((model) => (
              <ModelCard key={model.slug} model={model} />
            ))}
          </div>
        )}
        
        {/* Categories Info */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold text-white mb-6">Model Categories</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className="p-6 bg-white/5 rounded-xl border border-white/10 text-left hover:border-purple-500/50 transition"
              >
                <div className="text-2xl mb-2">
                  {cat.id === 'LLM' && '💬'}
                  {cat.id === 'IMAGE' && '🎨'}
                  {cat.id === 'CODE' && '💻'}
                  {cat.id === 'MULTIMODAL' && '🔮'}
                  {cat.id === 'AUDIO' && '🎵'}
                  {cat.id === 'VIDEO' && '🎬'}
                </div>
                <h3 className="text-lg font-bold text-white">{cat.name}</h3>
                <p className="text-white/60 text-sm mt-1">{cat.description}</p>
              </button>
            ))}
          </div>
        </section>
        
        {/* CTA */}
        <section className="mt-16 text-center">
          <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-2xl p-12 border border-purple-500/30">
            <h2 className="text-3xl font-black text-white mb-4">
              Ready to Pump?
            </h2>
            <p className="text-white/60 mb-8 max-w-xl mx-auto">
              Select a model and GPU tier to start running inference at blazing speeds.
              First 5 minutes are FREE!
            </p>
            <Link
              href={isAuthenticated ? '/dashboard' : '/login'}
              className="inline-block px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl text-white font-bold text-lg transition shadow-lg shadow-purple-500/30"
            >
              {isAuthenticated ? 'Go to Dashboard →' : 'Get Started Free →'}
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}

function ModelCard({ model }: { model: any }) {
  const categoryColors: Record<string, string> = {
    LLM: 'bg-blue-500/20 text-blue-400',
    IMAGE: 'bg-pink-500/20 text-pink-400',
    CODE: 'bg-green-500/20 text-green-400',
    MULTIMODAL: 'bg-purple-500/20 text-purple-400',
    AUDIO: 'bg-yellow-500/20 text-yellow-400',
    VIDEO: 'bg-red-500/20 text-red-400',
  }
  
  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:border-purple-500/50 transition">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-xl font-bold text-white">{model.name}</h3>
        <span className={`px-2 py-1 rounded text-xs font-medium ${categoryColors[model.category] || 'bg-gray-500/20 text-gray-400'}`}>
          {model.category}
        </span>
      </div>
      
      <p className="text-white/60 text-sm mb-4 line-clamp-2">
        {model.description}
      </p>
      
      <div className="flex items-center justify-between text-sm">
        <div className="text-white/40">
          Min {model.minVramGb}GB VRAM
        </div>
        {model.isFeatured && (
          <span className="text-yellow-400">⭐ Featured</span>
        )}
      </div>
      
      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="text-white/40 text-xs mb-2">Recommended GPUs</div>
        <div className="flex flex-wrap gap-1">
          {model.recommendedGpu?.slice(0, 2).map((gpu: string) => (
            <span key={gpu} className="px-2 py-1 bg-white/5 rounded text-white/60 text-xs">
              {gpu}
            </span>
          ))}
        </div>
      </div>
      
      <Link
        href={`/dashboard?model=${model.slug}`}
        className="mt-4 block w-full py-2 bg-purple-600/30 hover:bg-purple-600/50 rounded-lg text-purple-300 text-center font-medium transition"
      >
        Run This Model →
      </Link>
    </div>
  )
}
