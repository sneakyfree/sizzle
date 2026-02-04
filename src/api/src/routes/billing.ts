/**
 * Billing Routes
 * 
 * Handles credit purchases, subscriptions, and Stripe webhooks.
 * Uses Stripe for payment processing.
 */

import { Router, Request, Response, raw } from 'express'
import { z } from 'zod'
import prisma from '../lib/prisma'
import stripe, { 
  CREDIT_PACKAGES, 
  SUBSCRIPTION_TIERS,
  createCreditCheckout,
  createSubscriptionCheckout,
  handleWebhook 
} from '../lib/stripe'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// GET /api/billing/packages - List available credit packages (public)
router.get('/packages', (req: Request, res: Response) => {
  res.json({
    packages: Object.entries(CREDIT_PACKAGES).map(([id, pkg]) => ({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      credits: pkg.credits,
      bonusCredits: pkg.bonus,
      totalCredits: pkg.credits + pkg.bonus,
      price: pkg.price / 100, // Convert cents to dollars
      priceFormatted: `$${(pkg.price / 100).toFixed(2)}`,
      valuePerCredit: `$${((pkg.price / 100) / (pkg.credits + pkg.bonus)).toFixed(3)}`,
    })),
    currency: 'USD',
    message: 'Credits never expire. Buy more, save more! 💰',
  })
})

// GET /api/billing/subscriptions - List subscription tiers (public)
router.get('/subscriptions', (req: Request, res: Response) => {
  res.json({
    tiers: Object.entries(SUBSCRIPTION_TIERS).map(([id, tier]) => ({
      id,
      name: tier.name,
      priceMonthly: tier.price / 100,
      priceFormatted: `$${(tier.price / 100).toFixed(2)}/mo`,
      includedMinutes: tier.includedMinutes,
      features: id === 'pump_vpn' 
        ? ['120 GPU minutes/month', 'Access to all tiers', 'Priority support']
        : ['480 GPU minutes/month', 'Access to all tiers', 'Priority support', 'Dedicated instance option'],
    })),
    currency: 'USD',
    message: 'Subscribe and pump harder! 💪',
  })
})

// GET /api/billing/balance - Get user's current balance (requires auth)
router.get('/balance', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        creditBalance: true,
        freeMinutesRemaining: true,
        tier: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        autoTopup: true,
        autoTopupThreshold: true,
        autoTopupAmount: true,
      },
    })
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    
    // Get subscription status if subscribed
    let subscriptionStatus = null
    if (user.stripeSubscriptionId) {
      try {
        const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId)
        subscriptionStatus = {
          status: sub.status,
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        }
      } catch (e) {
        console.error('Error fetching subscription:', e)
      }
    }
    
    res.json({
      creditBalance: user.creditBalance,
      freeMinutesRemaining: user.freeMinutesRemaining,
      tier: user.tier,
      hasSubscription: !!user.stripeSubscriptionId,
      subscription: subscriptionStatus,
      autoTopup: {
        enabled: user.autoTopup,
        threshold: user.autoTopupThreshold,
        amount: user.autoTopupAmount,
      },
    })
  } catch (error) {
    console.error('Get balance error:', error)
    res.status(500).json({ error: 'Failed to get balance' })
  }
})

// POST /api/billing/checkout/credits - Create credit purchase checkout (requires auth)
router.post('/checkout/credits', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { packageId } = req.body
    const userId = (req as any).user.userId
    
    if (!packageId || !CREDIT_PACKAGES[packageId as keyof typeof CREDIT_PACKAGES]) {
      return res.status(400).json({ 
        error: 'Invalid package',
        validPackages: Object.keys(CREDIT_PACKAGES),
      })
    }
    
    // Get or create Stripe customer
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true, email: true },
    })
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    
    let customerId = user.stripeCustomerId
    
    if (!customerId) {
      // Create Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId },
      })
      customerId = customer.id
      
      // Save customer ID
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      })
    }
    
    // Create checkout session
    const { url } = await createCreditCheckout(userId, packageId as keyof typeof CREDIT_PACKAGES, customerId)
    
    res.json({
      checkoutUrl: url,
      package: CREDIT_PACKAGES[packageId as keyof typeof CREDIT_PACKAGES],
    })
  } catch (error) {
    console.error('Create checkout error:', error)
    res.status(500).json({ error: 'Failed to create checkout' })
  }
})

// POST /api/billing/checkout/subscription - Create subscription checkout (requires auth)
router.post('/checkout/subscription', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { tierId } = req.body
    const userId = (req as any).user.userId
    
    if (!tierId || !SUBSCRIPTION_TIERS[tierId as keyof typeof SUBSCRIPTION_TIERS]) {
      return res.status(400).json({ 
        error: 'Invalid tier',
        validTiers: Object.keys(SUBSCRIPTION_TIERS),
      })
    }
    
    // Get or create Stripe customer
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true, email: true, stripeSubscriptionId: true },
    })
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    
    if (user.stripeSubscriptionId) {
      return res.status(400).json({ 
        error: 'Already subscribed',
        message: 'Please manage your existing subscription first',
      })
    }
    
    let customerId = user.stripeCustomerId
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId },
      })
      customerId = customer.id
      
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      })
    }
    
    // Create checkout session
    const { url } = await createSubscriptionCheckout(userId, tierId as keyof typeof SUBSCRIPTION_TIERS, customerId)
    
    res.json({
      checkoutUrl: url,
      tier: SUBSCRIPTION_TIERS[tierId as keyof typeof SUBSCRIPTION_TIERS],
    })
  } catch (error) {
    console.error('Create subscription checkout error:', error)
    res.status(500).json({ error: 'Failed to create checkout' })
  }
})

// POST /api/billing/subscription/cancel - Cancel subscription (requires auth)
router.post('/subscription/cancel', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeSubscriptionId: true },
    })
    
    if (!user?.stripeSubscriptionId) {
      return res.status(400).json({ error: 'No active subscription' })
    }
    
    // Cancel at period end (not immediate)
    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
    })
    
    res.json({
      message: 'Subscription will be cancelled at the end of the billing period',
      cancelAtPeriodEnd: true,
    })
  } catch (error) {
    console.error('Cancel subscription error:', error)
    res.status(500).json({ error: 'Failed to cancel subscription' })
  }
})

// POST /api/billing/auto-topup - Configure auto top-up (requires auth)
router.post('/auto-topup', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { enabled, threshold, amount } = req.body
    const userId = (req as any).user.userId
    
    // Validate
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be boolean' })
    }
    
    if (enabled && (typeof threshold !== 'number' || threshold < 1)) {
      return res.status(400).json({ error: 'threshold must be >= 1' })
    }
    
    if (enabled && (typeof amount !== 'number' || amount < 10)) {
      return res.status(400).json({ error: 'amount must be >= 10' })
    }
    
    await prisma.user.update({
      where: { id: userId },
      data: {
        autoTopup: enabled,
        autoTopupThreshold: threshold || 10,
        autoTopupAmount: amount || 50,
      },
    })
    
    res.json({
      message: enabled ? 'Auto top-up enabled' : 'Auto top-up disabled',
      autoTopup: {
        enabled,
        threshold: threshold || 10,
        amount: amount || 50,
      },
    })
  } catch (error) {
    console.error('Auto topup error:', error)
    res.status(500).json({ error: 'Failed to update auto top-up' })
  }
})

// GET /api/billing/invoices - Get user's invoices (requires auth)
router.get('/invoices', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId
    const { limit = '20', offset = '0' } = req.query
    
    const invoices = await prisma.invoice.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit.toString()),
      skip: parseInt(offset.toString()),
      select: {
        id: true,
        stripeInvoiceId: true,
        amount: true,
        currency: true,
        status: true,
        description: true,
        paidAt: true,
        createdAt: true,
      },
    })
    
    const total = await prisma.invoice.count({ where: { userId } })
    
    res.json({
      invoices: invoices.map(inv => ({
        ...inv,
        status: inv.status.toLowerCase(),
        amountFormatted: `$${inv.amount.toFixed(2)}`,
      })),
      total,
      limit: parseInt(limit.toString()),
      offset: parseInt(offset.toString()),
    })
  } catch (error) {
    console.error('Get invoices error:', error)
    res.status(500).json({ error: 'Failed to get invoices' })
  }
})

// POST /api/billing/webhook - Stripe webhook handler
router.post('/webhook', raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature']
  
  if (!sig) {
    return res.status(400).json({ error: 'Missing signature' })
  }
  
  try {
    const { type, data } = await handleWebhook(req.body.toString(), sig.toString())
    
    console.log(`[stripe] Webhook received: ${type}`)
    
    switch (type) {
      case 'checkout.session.completed': {
        const session = data as any
        const userId = session.metadata?.userId
        const packageId = session.metadata?.packageId
        const tierId = session.metadata?.tierId
        const credits = parseInt(session.metadata?.credits || '0')
        
        if (userId && packageId && credits) {
          // Credit purchase completed
          await prisma.user.update({
            where: { id: userId },
            data: {
              creditBalance: { increment: credits },
            },
          })
          
          // Create invoice record
          await prisma.invoice.create({
            data: {
              userId,
              stripeInvoiceId: session.id,
              amount: session.amount_total / 100,
              currency: session.currency.toUpperCase(),
              status: 'PAID',
              description: `Credit purchase: ${credits} credits`,
              paidAt: new Date(),
            },
          })
          
          console.log(`[stripe] Added ${credits} credits to user ${userId}`)
        }
        
        if (userId && tierId) {
          // Subscription started
          const tierMap: Record<string, any> = {
            'pump_vpn': 'PUMP_VPN',
            'pump_home': 'PUMP_HOME',
          }
          
          await prisma.user.update({
            where: { id: userId },
            data: {
              tier: tierMap[tierId] || 'FREE',
              stripeSubscriptionId: session.subscription,
            },
          })
          
          console.log(`[stripe] User ${userId} subscribed to ${tierId}`)
        }
        break
      }
      
      case 'customer.subscription.deleted': {
        const subscription = data as any
        
        // Find user by subscription ID
        const user = await prisma.user.findFirst({
          where: { stripeSubscriptionId: subscription.id },
        })
        
        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              tier: 'FREE',
              stripeSubscriptionId: null,
            },
          })
          
          console.log(`[stripe] Subscription cancelled for user ${user.id}`)
        }
        break
      }
      
      case 'invoice.payment_failed': {
        const invoice = data as any
        console.error(`[stripe] Payment failed for invoice ${invoice.id}`)
        // TODO: Notify user, retry logic, etc.
        break
      }
      
      default:
        console.log(`[stripe] Unhandled webhook: ${type}`)
    }
    
    res.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    res.status(400).json({ error: 'Webhook verification failed' })
  }
})

// GET /api/billing/portal - Create Stripe billing portal session (requires auth)
router.get('/portal', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    })
    
    if (!user?.stripeCustomerId) {
      return res.status(400).json({ error: 'No billing account' })
    }
    
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/billing`,
    })
    
    res.json({ portalUrl: session.url })
  } catch (error) {
    console.error('Create portal error:', error)
    res.status(500).json({ error: 'Failed to create billing portal' })
  }
})

export default router
