'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth, useBalance, useCreditPackages } from '../../lib/hooks'
import api from '../../lib/api'

export default function BillingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const success = searchParams.get('success')
  const cancelled = searchParams.get('cancelled')
  
  const { user, loading: authLoading, isAuthenticated } = useAuth()
  const { balance, loading: balanceLoading, refresh: refreshBalance } = useBalance()
  const { packages, loading: packagesLoading } = useCreditPackages()
  
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/billing')
    }
  }, [authLoading, isAuthenticated, router])
  
  // Load subscriptions and invoices
  useEffect(() => {
    async function load() {
      try {
        const [subsData, invoicesData] = await Promise.all([
          api.getSubscriptionTiers(),
          api.getInvoices({ limit: 5 }),
        ])
        setSubscriptions(subsData.tiers)
        setInvoices(invoicesData.invoices)
      } catch (err) {
        console.error('Failed to load billing data:', err)
      }
    }
    if (isAuthenticated) load()
  }, [isAuthenticated])
  
  // Refresh balance after successful payment
  useEffect(() => {
    if (success) {
      refreshBalance()
    }
  }, [success, refreshBalance])
  
  const handleBuyCredits = async (packageId: string) => {
    setLoading(true)
    setError(null)
    try {
      const { checkoutUrl } = await api.createCreditCheckout(packageId)
      window.location.href = checkoutUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create checkout')
      setLoading(false)
    }
  }
  
  const handleSubscribe = async (tierId: string) => {
    setLoading(true)
    setError(null)
    try {
      const { checkoutUrl } = await api.createSubscriptionCheckout(tierId)
      window.location.href = checkoutUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create checkout')
      setLoading(false)
    }
  }
  
  const handleManageBilling = async () => {
    setLoading(true)
    try {
      const { portalUrl } = await api.getBillingPortal()
      window.location.href = portalUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open billing portal')
      setLoading(false)
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
          <Link href="/dashboard" className="text-white/60 hover:text-white">
            ← Back to Dashboard
          </Link>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Success/Cancel Banners */}
        {success && (
          <div className="mb-8 p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400">
            ✅ Payment successful! Your credits have been added.
          </div>
        )}
        {cancelled && (
          <div className="mb-8 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-400">
            Payment was cancelled. No charges were made.
          </div>
        )}
        
        {/* Error Display */}
        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
            {error}
          </div>
        )}
        
        <h1 className="text-4xl font-black text-white mb-2">Billing</h1>
        <p className="text-white/60 text-lg mb-12">
          Add credits or subscribe for the best pumping experience
        </p>
        
        {/* Current Balance */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-8 border border-white/10 mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">Your Balance</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-white/40 text-sm mb-1">Credits</div>
              <div className="text-4xl font-black text-green-400">
                ${balanceLoading ? '...' : (balance?.creditBalance || 0).toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-white/40 text-sm mb-1">Free Minutes</div>
              <div className="text-4xl font-black text-purple-400">
                {balanceLoading ? '...' : balance?.freeMinutesRemaining || 0}
              </div>
            </div>
            <div>
              <div className="text-white/40 text-sm mb-1">Plan</div>
              <div className="text-4xl font-black text-white">
                {balanceLoading ? '...' : balance?.tier || 'FREE'}
              </div>
            </div>
          </div>
          
          {balance?.hasSubscription && (
            <button
              onClick={handleManageBilling}
              disabled={loading}
              className="mt-6 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white font-medium transition"
            >
              Manage Subscription →
            </button>
          )}
        </div>
        
        {/* Credit Packages */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">Buy Credits</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {packagesLoading ? (
              <div className="col-span-full text-white/60">Loading packages...</div>
            ) : (
              packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:border-purple-500/50 transition"
                >
                  <div className="text-2xl mb-2">
                    {pkg.id === 'starter' && '🌱'}
                    {pkg.id === 'regular' && '💰'}
                    {pkg.id === 'pro' && '💎'}
                    {pkg.id === 'whale' && '🐳'}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">{pkg.name}</h3>
                  <div className="text-3xl font-black text-purple-400 mb-2">
                    {pkg.priceFormatted}
                  </div>
                  <div className="text-white/60 text-sm mb-4">
                    {pkg.credits} credits
                    {pkg.bonusCredits > 0 && (
                      <span className="text-green-400 ml-1">+ {pkg.bonusCredits} bonus!</span>
                    )}
                  </div>
                  <div className="text-white/40 text-xs mb-4">
                    {pkg.valuePerCredit}/credit
                  </div>
                  <button
                    onClick={() => handleBuyCredits(pkg.id)}
                    disabled={loading}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded-xl text-white font-bold transition"
                  >
                    {loading ? 'Processing...' : 'Buy Now'}
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
        
        {/* Subscriptions */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">Subscription Plans</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {subscriptions.map((tier) => (
              <div
                key={tier.id}
                className="bg-white/5 backdrop-blur-xl rounded-2xl p-8 border border-white/10"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-white">{tier.name}</h3>
                    <div className="text-3xl font-black text-purple-400 mt-1">
                      {tier.priceFormatted}
                    </div>
                  </div>
                  <span className="text-4xl">
                    {tier.id === 'pump_vpn' ? '🚀' : '🏠'}
                  </span>
                </div>
                
                <ul className="space-y-2 mb-6">
                  {tier.features?.map((feature: string, i: number) => (
                    <li key={i} className="flex items-center gap-2 text-white/80">
                      <span className="text-green-400">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                
                <button
                  onClick={() => handleSubscribe(tier.id)}
                  disabled={loading || balance?.hasSubscription}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-600 disabled:to-gray-600 rounded-xl text-white font-bold transition"
                >
                  {balance?.hasSubscription ? 'Already Subscribed' : loading ? 'Processing...' : 'Subscribe'}
                </button>
              </div>
            ))}
          </div>
        </section>
        
        {/* Recent Invoices */}
        {invoices.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold text-white mb-6">Recent Invoices</h2>
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-6 py-4 text-left text-white/60 font-medium">Date</th>
                    <th className="px-6 py-4 text-left text-white/60 font-medium">Description</th>
                    <th className="px-6 py-4 text-left text-white/60 font-medium">Amount</th>
                    <th className="px-6 py-4 text-left text-white/60 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-white/5">
                      <td className="px-6 py-4 text-white">
                        {new Date(invoice.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-white/80">{invoice.description}</td>
                      <td className="px-6 py-4 text-white font-bold">{invoice.amountFormatted}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          invoice.status === 'paid' 
                            ? 'bg-green-500/20 text-green-400'
                            : invoice.status === 'pending'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {invoice.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
