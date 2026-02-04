/**
 * Stripe Client Configuration
 * 
 * Handles all Stripe API interactions for billing
 */

import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('⚠️ STRIPE_SECRET_KEY not set - billing features disabled')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
  typescript: true,
})

// Credit packages
export const CREDIT_PACKAGES = {
  starter: {
    id: 'credits_starter',
    credits: 10,
    price: 1000, // $10.00 in cents
    bonus: 0,
    stripePriceId: process.env.STRIPE_PRICE_STARTER,
  },
  regular: {
    id: 'credits_regular', 
    credits: 50,
    price: 4500, // $45.00
    bonus: 5,
    stripePriceId: process.env.STRIPE_PRICE_REGULAR,
  },
  pro: {
    id: 'credits_pro',
    credits: 100,
    price: 8000, // $80.00
    bonus: 20,
    stripePriceId: process.env.STRIPE_PRICE_PRO,
  },
  whale: {
    id: 'credits_whale',
    credits: 500,
    price: 35000, // $350.00
    bonus: 150,
    stripePriceId: process.env.STRIPE_PRICE_WHALE,
  },
}

// Subscription tiers
export const SUBSCRIPTION_TIERS = {
  pump_vpn: {
    id: 'pump_vpn',
    name: 'Pump VPN',
    price: 4900, // $49.00/mo
    includedMinutes: 120,
    stripePriceId: process.env.STRIPE_PRICE_VPN,
  },
  pump_home: {
    id: 'pump_home',
    name: 'Pump Home',
    price: 14900, // $149.00/mo
    includedMinutes: 480,
    stripePriceId: process.env.STRIPE_PRICE_HOME,
  },
}

/**
 * Create a Stripe checkout session for credit purchase
 */
export async function createCreditCheckout(
  userId: string,
  packageId: keyof typeof CREDIT_PACKAGES,
  customerId?: string
): Promise<{ url: string }> {
  const pkg = CREDIT_PACKAGES[packageId]
  if (!pkg) throw new Error('Invalid package')
  
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Sizzle Credits - ${pkg.credits + pkg.bonus} credits`,
            description: pkg.bonus > 0 
              ? `${pkg.credits} credits + ${pkg.bonus} bonus credits`
              : `${pkg.credits} credits`,
          },
          unit_amount: pkg.price,
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId,
      packageId,
      credits: pkg.credits + pkg.bonus,
    },
    success_url: `${process.env.FRONTEND_URL}/billing?success=true`,
    cancel_url: `${process.env.FRONTEND_URL}/billing?cancelled=true`,
  })
  
  return { url: session.url! }
}

/**
 * Create a Stripe checkout session for subscription
 */
export async function createSubscriptionCheckout(
  userId: string,
  tierId: keyof typeof SUBSCRIPTION_TIERS,
  customerId?: string
): Promise<{ url: string }> {
  const tier = SUBSCRIPTION_TIERS[tierId]
  if (!tier) throw new Error('Invalid tier')
  
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: tier.name,
            description: `${tier.includedMinutes} GPU minutes/month included`,
          },
          unit_amount: tier.price,
          recurring: { interval: 'month' },
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId,
      tierId,
    },
    success_url: `${process.env.FRONTEND_URL}/billing?success=true`,
    cancel_url: `${process.env.FRONTEND_URL}/billing?cancelled=true`,
  })
  
  return { url: session.url! }
}

/**
 * Handle Stripe webhook events
 */
export async function handleWebhook(
  payload: string,
  signature: string
): Promise<{ type: string; data: any }> {
  const event = stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET || ''
  )
  
  return {
    type: event.type,
    data: event.data.object,
  }
}

export default stripe
