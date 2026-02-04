'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth, useSessions } from '../../lib/hooks'

export default function HistoryPage() {
  const router = useRouter()
  const { user, loading: authLoading, isAuthenticated } = useAuth()
  const { sessions, total, loading, error, refresh } = useSessions()
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/history')
    }
  }, [authLoading, isAuthenticated, router])
  
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }
  
  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    provisioning: 'bg-blue-500/20 text-blue-400',
    running: 'bg-green-500/20 text-green-400',
    paused: 'bg-orange-500/20 text-orange-400',
    terminated: 'bg-gray-500/20 text-gray-400',
    error: 'bg-red-500/20 text-red-400',
  }
  
  const totalCost = sessions.reduce((sum, s) => sum + (s.currentCost || 0), 0)
  const totalMinutes = sessions.reduce((sum, s) => sum + (s.runningMinutes || 0), 0)
  
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
            <Link href="/billing" className="text-white/60 hover:text-white">
              Billing
            </Link>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-12">
          <h1 className="text-4xl font-black text-white mb-2">
            Session History 📜
          </h1>
          <p className="text-white/60 text-lg">
            Your GPU session history and usage stats
          </p>
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <StatCard
            label="Total Sessions"
            value={total.toString()}
            icon="📊"
          />
          <StatCard
            label="Total Minutes"
            value={Math.round(totalMinutes).toString()}
            icon="⏱️"
          />
          <StatCard
            label="Total Spent"
            value={`$${totalCost.toFixed(2)}`}
            icon="💰"
          />
          <StatCard
            label="Active Now"
            value={sessions.filter(s => s.status === 'running').length.toString()}
            icon="🟢"
          />
        </div>
        
        {/* Error */}
        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
            {error}
          </div>
        )}
        
        {/* Sessions Table */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-white/60">Loading sessions...</div>
          ) : sessions.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">🚀</div>
              <div className="text-white text-xl font-bold mb-2">No sessions yet</div>
              <div className="text-white/60 mb-6">Start your first GPU session to see it here</div>
              <Link
                href="/dashboard"
                className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl text-white font-bold transition"
              >
                Start Pumping →
              </Link>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-6 py-4 text-left text-white/60 font-medium">Session</th>
                  <th className="px-6 py-4 text-left text-white/60 font-medium">GPU</th>
                  <th className="px-6 py-4 text-left text-white/60 font-medium">Model</th>
                  <th className="px-6 py-4 text-left text-white/60 font-medium">Duration</th>
                  <th className="px-6 py-4 text-left text-white/60 font-medium">Cost</th>
                  <th className="px-6 py-4 text-left text-white/60 font-medium">Status</th>
                  <th className="px-6 py-4 text-left text-white/60 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.sessionId} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-6 py-4">
                      <div className="text-white font-medium">{session.tier.toUpperCase()}</div>
                      <div className="text-white/40 text-xs font-mono">{session.sessionId.slice(0, 12)}...</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-white">{session.gpu}</div>
                      <div className="text-white/40 text-xs">{session.gpuCount}x via {session.provider}</div>
                    </td>
                    <td className="px-6 py-4 text-white/80">
                      {session.modelName || '-'}
                    </td>
                    <td className="px-6 py-4 text-white">
                      {session.runningMinutes ? `${Math.round(session.runningMinutes)} min` : '-'}
                    </td>
                    <td className="px-6 py-4 text-green-400 font-bold">
                      ${(session.currentCost || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[session.status]}`}>
                        {session.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/session/${session.sessionId}`}
                        className="text-purple-400 hover:text-purple-300 text-sm"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        {/* Pagination hint */}
        {total > sessions.length && (
          <div className="mt-6 text-center text-white/40">
            Showing {sessions.length} of {total} sessions
          </div>
        )}
      </main>
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
      <div className="flex items-center justify-between mb-2">
        <span className="text-white/40 text-sm">{label}</span>
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="text-3xl font-black text-white">{value}</div>
    </div>
  )
}
