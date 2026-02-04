import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="text-9xl mb-4">💪</div>
        <h1 className="text-6xl font-black text-white mb-4">404</h1>
        <p className="text-white/60 text-xl mb-8">
          This page skipped leg day and doesn't exist.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/"
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl text-white font-bold transition"
          >
            ← Back Home
          </Link>
          <Link
            href="/dashboard"
            className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white font-bold transition"
          >
            Start Pumping →
          </Link>
        </div>
      </div>
    </div>
  )
}
