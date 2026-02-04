'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../../lib/hooks'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/dashboard'
  
  const { user, loading, login, register, isAuthenticated } = useAuth()
  
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  
  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.push(redirect)
    }
  }, [loading, isAuthenticated, router, redirect])
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, password, name || undefined)
      }
      router.push(redirect)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setSubmitting(false)
    }
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="text-4xl font-black text-white inline-block">
            💪 PUMP ME
          </Link>
          <p className="text-white/60 mt-2">
            {mode === 'login' ? 'Welcome back, pumper!' : 'Join the pump revolution!'}
          </p>
        </div>
        
        {/* Card */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-8 border border-white/10">
          {/* Tabs */}
          <div className="flex mb-6 bg-black/20 rounded-xl p-1">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2 rounded-lg font-medium transition ${
                mode === 'login'
                  ? 'bg-purple-600 text-white'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 py-2 rounded-lg font-medium transition ${
                mode === 'register'
                  ? 'bg-purple-600 text-white'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Register
            </button>
          </div>
          
          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}
          
          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-white/60 text-sm mb-2">Name (optional)</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
                />
              </div>
            )}
            
            <div>
              <label className="block text-white/60 text-sm mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
              />
            </div>
            
            <div>
              <label className="block text-white/60 text-sm mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? '8+ characters' : '••••••••'}
                required
                minLength={mode === 'register' ? 8 : undefined}
                className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
              />
            </div>
            
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-600 disabled:to-gray-600 rounded-xl text-white font-bold text-lg transition shadow-lg shadow-purple-500/30"
            >
              {submitting ? (
                <span className="animate-pulse">Processing...</span>
              ) : mode === 'login' ? (
                'Login →'
              ) : (
                'Create Account →'
              )}
            </button>
          </form>
          
          {/* Free Minutes Banner (for register) */}
          {mode === 'register' && (
            <div className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎁</span>
                <div>
                  <div className="text-green-400 font-bold">5 FREE Beast Mode Minutes!</div>
                  <div className="text-white/60 text-sm">No credit card required to start</div>
                </div>
              </div>
            </div>
          )}
          
          {/* Forgot Password (for login) */}
          {mode === 'login' && (
            <div className="mt-4 text-center">
              <Link href="/forgot-password" className="text-purple-400 hover:underline text-sm">
                Forgot your password?
              </Link>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="mt-8 text-center text-white/40 text-sm">
          By continuing, you agree to our{' '}
          <Link href="/terms" className="text-purple-400 hover:underline">Terms</Link>
          {' '}and{' '}
          <Link href="/privacy" className="text-purple-400 hover:underline">Privacy Policy</Link>
        </div>
      </div>
    </div>
  )
}
