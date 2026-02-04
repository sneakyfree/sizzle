export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="relative">
          <div className="text-8xl animate-bounce">💪</div>
          <div className="absolute inset-0 text-8xl animate-ping opacity-30">💪</div>
        </div>
        <p className="text-white/60 text-xl mt-8 animate-pulse">
          Pumping...
        </p>
      </div>
    </div>
  )
}
