import Link from 'next/link'

// GPU Tier cards
const GPU_TIERS = [
  {
    name: 'Starter',
    gpu: 'RTX 5090',
    price: '$0.15/min',
    description: 'Perfect for learning & small projects',
    icon: '🔥',
    popular: false,
  },
  {
    name: 'Pro',
    gpu: 'A100 80GB',
    price: '$0.45/min',
    description: 'Production workloads & training',
    icon: '⚡',
    popular: true,
  },
  {
    name: 'Beast Mode',
    gpu: '8x H100 NVLink',
    price: '$1.50/min',
    description: 'Maximum performance',
    icon: '💪',
    popular: false,
  },
  {
    name: 'Ultra Beast',
    gpu: '16x B300',
    price: '$4.00/min',
    description: 'Render an Oscar film in hours',
    icon: '🚀',
    popular: false,
  },
]

// Testimonials
const TESTIMONIALS = [
  {
    quote: "I rendered my entire indie film in 8 hours. On my home PC it would have taken 14 months.",
    author: "Indie Filmmaker",
    title: "Sundance 2027 Winner",
  },
  {
    quote: "Sizzle is my secret weapon. I shipped 47 MVPs in a weekend.",
    author: "Vibe Coder",
    title: "Serial Entrepreneur",
  },
  {
    quote: "I didn't know Linux. I never touched a terminal. I just clicked buttons.",
    author: "Solo Creator",
    title: "First-time AI User",
  },
]

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-pump-dark via-pump-secondary to-pump-dark" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        
        {/* Animated glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-pump-primary/20 rounded-full blur-[150px]" />
        
        <div className="relative max-w-7xl mx-auto px-4 pt-20 pb-32">
          {/* Nav */}
          <nav className="flex items-center justify-between mb-20">
            <div className="flex items-center gap-2">
              <span className="text-3xl">💪</span>
              <span className="text-2xl font-bold">Sizzle</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/pricing" className="text-white/70 hover:text-white transition">Pricing</Link>
              <Link href="/models" className="text-white/70 hover:text-white transition">Models</Link>
              <Link href="/docs" className="text-white/70 hover:text-white transition">Docs</Link>
              <Link href="/login" className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition">
                Log In
              </Link>
              <Link href="/signup" className="pump-button px-6 py-2 rounded-lg font-medium">
                Start Pumping
              </Link>
            </div>
          </nav>
          
          {/* Hero content */}
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-pump-primary/20 text-pump-primary mb-8">
              <span className="animate-pulse">🔴</span>
              <span className="text-sm font-medium">5 FREE Beast Mode minutes for new users</span>
            </div>
            
            <h1 className="text-6xl md:text-7xl font-bold mb-6 leading-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-pump-primary to-pump-accent">
                Beast-Mode GPUs
              </span>
              <br />
              by the Minute
            </h1>
            
            <p className="text-xl text-white/60 mb-10 max-w-2xl mx-auto">
              The most normie-friendly GPU compute platform in the world. 
              H100s, B300s, 5090s — no terminal required. Just click and pump.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup" className="pump-button px-8 py-4 rounded-xl text-lg font-semibold">
                Start Pumping Free →
              </Link>
              <Link href="/demo" className="px-8 py-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition text-lg">
                Watch Demo
              </Link>
            </div>
            
            {/* Trust badges */}
            <div className="mt-16 flex items-center justify-center gap-8 text-white/40 text-sm">
              <span>Trusted by 10,000+ creators</span>
              <span>•</span>
              <span>50M+ GPU minutes served</span>
              <span>•</span>
              <span>99.9% uptime</span>
            </div>
          </div>
        </div>
      </section>
      
      {/* GPU Tiers Section */}
      <section className="py-24 bg-pump-secondary/50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Choose Your Power Level</h2>
            <p className="text-white/60 text-lg">From learning to rendering Oscar films</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {GPU_TIERS.map((tier) => (
              <div 
                key={tier.name}
                className={`glass-card rounded-2xl p-6 relative ${
                  tier.popular ? 'ring-2 ring-pump-primary' : ''
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-pump-primary rounded-full text-xs font-bold">
                    MOST POPULAR
                  </div>
                )}
                <div className="text-4xl mb-4">{tier.icon}</div>
                <h3 className="text-xl font-bold mb-1">{tier.name}</h3>
                <p className="text-pump-accent text-sm mb-2">{tier.gpu}</p>
                <p className="text-3xl font-bold mb-3">{tier.price}</p>
                <p className="text-white/60 text-sm mb-6">{tier.description}</p>
                <button className="w-full py-3 rounded-lg bg-white/10 hover:bg-white/20 transition font-medium">
                  Select
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* How It Works */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Stupid Simple</h2>
            <p className="text-white/60 text-lg">From zero to pumping in 60 seconds</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-pump-primary/20 flex items-center justify-center text-3xl mx-auto mb-6">
                1
              </div>
              <h3 className="text-xl font-bold mb-3">Pick Your GPU</h3>
              <p className="text-white/60">Choose from RTX 5090 to 16x B300. We recommend the best fit for your task.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-pump-primary/20 flex items-center justify-center text-3xl mx-auto mb-6">
                2
              </div>
              <h3 className="text-xl font-bold mb-3">Select a Model</h3>
              <p className="text-white/60">Pre-loaded with 500+ models. Llama, Stable Diffusion, Whisper — all ready to go.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-pump-primary/20 flex items-center justify-center text-3xl mx-auto mb-6">
                3
              </div>
              <h3 className="text-xl font-bold mb-3">Pump</h3>
              <p className="text-white/60">Click "Start" and pump. Pay only for the minutes you use. Stop anytime.</p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Testimonials */}
      <section className="py-24 bg-pump-secondary/50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">What Pumpers Say</h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {TESTIMONIALS.map((testimonial, i) => (
              <div key={i} className="glass-card rounded-2xl p-8">
                <p className="text-lg mb-6 text-white/80">"{testimonial.quote}"</p>
                <div>
                  <p className="font-bold">{testimonial.author}</p>
                  <p className="text-pump-accent text-sm">{testimonial.title}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* CTA */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-5xl font-bold mb-6">Ready to Pump?</h2>
          <p className="text-xl text-white/60 mb-10">
            5 free Beast Mode minutes. No credit card required.
          </p>
          <Link href="/signup" className="pump-button inline-block px-10 py-5 rounded-xl text-xl font-semibold">
            Start Pumping Free →
          </Link>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="border-t border-white/10 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <span className="text-2xl">💪</span>
              <span className="text-xl font-bold">Sizzle</span>
            </div>
            <div className="flex items-center gap-8 text-white/60 text-sm">
              <Link href="/privacy" className="hover:text-white transition">Privacy</Link>
              <Link href="/terms" className="hover:text-white transition">Terms</Link>
              <Link href="/acceptable-use" className="hover:text-white transition">Acceptable Use</Link>
              <Link href="/contact" className="hover:text-white transition">Contact</Link>
            </div>
            <p className="text-white/40 text-sm">© 2026 Sizzle. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </main>
  )
}
