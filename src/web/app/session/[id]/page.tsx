'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth, useSession } from '../../../lib/hooks'

export default function SessionPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string
  
  const { user, loading: authLoading, isAuthenticated } = useAuth()
  const { session, loading, error, stop } = useSession(sessionId)
  const [stopping, setStopping] = useState(false)
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [authLoading, isAuthenticated, router])
  
  const handleStop = async () => {
    if (!confirm('Are you sure you want to stop this session?')) return
    
    setStopping(true)
    try {
      await stop()
    } finally {
      setStopping(false)
    }
  }
  
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading session...</div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">{error}</div>
          <Link href="/dashboard" className="text-purple-400 hover:underline">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }
  
  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-white/60 text-xl mb-4">Session not found</div>
          <Link href="/dashboard" className="text-purple-400 hover:underline">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }
  
  const statusColors: Record<string, string> = {
    pending: 'text-yellow-400',
    provisioning: 'text-blue-400',
    running: 'text-green-400',
    paused: 'text-orange-400',
    terminated: 'text-gray-400',
    error: 'text-red-400',
  }
  
  const statusEmoji: Record<string, string> = {
    pending: '⏳',
    provisioning: '🔄',
    running: '🟢',
    paused: '⏸️',
    terminated: '⏹️',
    error: '❌',
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-black text-white">
            💪 PUMP ME
          </Link>
          <Link href="/dashboard" className="text-white/60 hover:text-white">
            ← Back to Dashboard
          </Link>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Session Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">{statusEmoji[session.status]}</span>
              <h1 className="text-3xl font-black text-white">
                {session.tier.toUpperCase()} Session
              </h1>
            </div>
            <p className="text-white/60 font-mono text-sm">{session.sessionId}</p>
          </div>
          
          <div className="text-right">
            <div className={`text-2xl font-bold ${statusColors[session.status]}`}>
              {session.status.toUpperCase()}
            </div>
            {session.status === 'running' && session.runningMinutes && (
              <div className="text-white/60 mt-1">
                Running for {Math.floor(session.runningMinutes)} minutes
              </div>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* GPU Info */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
              <h2 className="text-xl font-bold text-white mb-4">GPU Configuration</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-white/40 text-sm">GPU Type</div>
                  <div className="text-white font-bold text-lg">{session.gpu}</div>
                </div>
                <div>
                  <div className="text-white/40 text-sm">Count</div>
                  <div className="text-white font-bold text-lg">{session.gpuCount}x</div>
                </div>
                <div>
                  <div className="text-white/40 text-sm">Provider</div>
                  <div className="text-white font-bold text-lg capitalize">{session.provider}</div>
                </div>
                <div>
                  <div className="text-white/40 text-sm">Price</div>
                  <div className="text-purple-400 font-bold text-lg">
                    ${session.pricePerMinute.toFixed(4)}/min
                  </div>
                </div>
              </div>
            </div>
            
            {/* Access Panel */}
            {session.status === 'running' && (
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
                <h2 className="text-xl font-bold text-white mb-4">Access Your GPU</h2>
                
                {session.accessUrl && (
                  <div className="mb-4">
                    <div className="text-white/40 text-sm mb-1">Web UI</div>
                    <a 
                      href={session.accessUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 hover:underline break-all"
                    >
                      {session.accessUrl}
                    </a>
                  </div>
                )}
                
                {session.sshHost && session.sshPort && (
                  <div>
                    <div className="text-white/40 text-sm mb-1">SSH Access</div>
                    <code className="bg-black/30 px-3 py-2 rounded-lg block text-green-400 font-mono">
                      ssh -p {session.sshPort} root@{session.sshHost}
                    </code>
                  </div>
                )}
                
                {!session.accessUrl && !session.sshHost && (
                  <div className="text-white/60">
                    Access details will appear here once the GPU is ready...
                  </div>
                )}
              </div>
            )}
            
            {/* GPU Metrics */}
            {session.status === 'running' && session.metrics && (
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
                <h2 className="text-xl font-bold text-white mb-4">Live Metrics</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MetricCard
                    label="GPU Utilization"
                    value={`${session.metrics.gpuUtilization}%`}
                    color="text-green-400"
                  />
                  <MetricCard
                    label="Memory Used"
                    value={`${session.metrics.memoryUsed}%`}
                    color="text-blue-400"
                  />
                  <MetricCard
                    label="Temperature"
                    value={`${session.metrics.temperature}°C`}
                    color={session.metrics.temperature > 80 ? 'text-red-400' : 'text-yellow-400'}
                  />
                  <MetricCard
                    label="Power Draw"
                    value={`${session.metrics.powerDraw}W`}
                    color="text-purple-400"
                  />
                </div>
              </div>
            )}
            
            {/* Model Info */}
            {session.modelName && (
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
                <h2 className="text-xl font-bold text-white mb-4">Loaded Model</h2>
                <div className="text-white text-lg font-bold">{session.modelName}</div>
                <div className="text-white/60 text-sm">{session.modelId}</div>
              </div>
            )}
          </div>
          
          {/* Sidebar */}
          <div className="space-y-6">
            {/* Cost Tracker */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
              <h2 className="text-xl font-bold text-white mb-4">Cost Tracker</h2>
              <div className="text-4xl font-black text-green-400 mb-2">
                ${(session.currentCost || 0).toFixed(4)}
              </div>
              <div className="text-white/60 text-sm">
                {session.runningMinutes?.toFixed(2) || 0} minutes at ${session.pricePerMinute.toFixed(4)}/min
              </div>
              
              {session.status === 'running' && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="text-white/40 text-sm">Projected (1 hour)</div>
                  <div className="text-white font-bold">
                    ${(session.pricePerMinute * 60).toFixed(2)}
                  </div>
                </div>
              )}
            </div>
            
            {/* Actions */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
              <h2 className="text-xl font-bold text-white mb-4">Actions</h2>
              
              {(session.status === 'running' || session.status === 'provisioning') && (
                <button
                  onClick={handleStop}
                  disabled={stopping}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded-xl text-white font-bold transition"
                >
                  {stopping ? 'Stopping...' : '⏹️ Stop Session'}
                </button>
              )}
              
              {session.status === 'terminated' && (
                <Link
                  href="/dashboard"
                  className="block w-full py-3 bg-purple-600 hover:bg-purple-700 rounded-xl text-white font-bold text-center transition"
                >
                  🚀 Start New Session
                </Link>
              )}
              
              {session.status === 'error' && (
                <div className="text-red-400 text-sm">
                  Something went wrong. Please try starting a new session.
                </div>
              )}
            </div>
            
            {/* Timeline */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
              <h2 className="text-xl font-bold text-white mb-4">Timeline</h2>
              <div className="space-y-3 text-sm">
                <TimelineItem
                  label="Created"
                  time={session.startedAt}
                  active
                />
                {session.status === 'running' && (
                  <TimelineItem
                    label="Running"
                    time={new Date().toISOString()}
                    active
                  />
                )}
                {session.status === 'terminated' && (
                  <TimelineItem
                    label="Terminated"
                    time={new Date().toISOString()}
                    active={false}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-black/20 rounded-xl p-4">
      <div className="text-white/40 text-xs mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  )
}

function TimelineItem({ label, time, active }: { label: string; time?: string; active: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`w-2 h-2 rounded-full mt-1.5 ${active ? 'bg-green-400' : 'bg-gray-500'}`} />
      <div>
        <div className="text-white font-medium">{label}</div>
        {time && (
          <div className="text-white/40 text-xs">
            {new Date(time).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  )
}
