/**
 * Session Routes
 * 
 * Handles GPU session lifecycle: create, status, stop, metrics.
 * Uses provider registry for multi-cloud GPU provisioning.
 */

import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import prisma from '../lib/prisma'
import { requireAuth as authMiddleware } from '../middleware/auth'
import providers, { provisionWithBestProvider } from '../providers'
import { GPU_TIERS, GpuTier } from '../types/provider'

const router = Router()

// Validation schemas
const createSessionSchema = z.object({
  tier: z.enum(['starter', 'pro', 'beast', 'ultra']),
  modelId: z.string().optional(),
  modelName: z.string().optional(),
  duration: z.number().min(5).max(1440).optional(), // 5 min to 24 hours
  provider: z.string().optional(), // Optional: force specific provider
})

// GET /api/sessions/tiers - List available GPU tiers (public)
router.get('/tiers', (req: Request, res: Response) => {
  res.json({
    tiers: Object.fromEntries(
      Object.entries(GPU_TIERS).map(([key, tier]) => [
        key,
        {
          name: tier.name,
          description: tier.description,
          gpuOptions: tier.gpuOptions,
          pricePerMinute: tier.pricePerMinute,
          pricePerHour: tier.pricePerMinute * 60,
        },
      ])
    ),
    message: 'Select a tier to start pumping! 💪',
  })
})

// GET /api/sessions/providers - List available providers and health (public)
router.get('/providers', async (req: Request, res: Response) => {
  try {
    const health = await providers.getProvidersHealth()
    
    res.json({
      providers: health.map(h => ({
        id: h.provider,
        name: providers.getProvider(h.provider)?.name || h.provider,
        isHealthy: h.isHealthy,
        latencyMs: h.latencyMs,
        lastCheck: h.lastCheck,
        availableGpus: h.availableGpus,
        error: h.error,
      })),
    })
  } catch (error) {
    console.error('Get providers error:', error)
    res.status(500).json({ error: 'Failed to get providers' })
  }
})

// POST /api/sessions/create - Create a new Pump Session (requires auth)
router.post('/create', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { tier, modelId, modelName, duration, provider } = createSessionSchema.parse(req.body)
    const userId = (req as any).user.userId
    
    // Get user to check balance
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        creditBalance: true,
        freeMinutesRemaining: true,
        tier: true,
      },
    })
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    
    const tierConfig = GPU_TIERS[tier as GpuTier]
    const estimatedCost = (duration || 60) * tierConfig.pricePerMinute
    
    // Check if user has enough balance (free minutes + credits)
    const totalBalance = user.freeMinutesRemaining + (user.creditBalance / tierConfig.pricePerMinute)
    if (totalBalance < 5) { // Minimum 5 minutes required
      return res.status(402).json({
        error: 'Insufficient balance',
        code: 'INSUFFICIENT_BALANCE',
        message: 'Please add credits to start pumping!',
        balance: {
          credits: user.creditBalance,
          freeMinutes: user.freeMinutesRemaining,
          requiredMinimum: 5,
        },
      })
    }
    
    // Generate session ID
    const sessionId = `pump_${uuidv4().replace(/-/g, '').slice(0, 12)}`
    
    // Create session record (pending)
    const session = await prisma.pumpSession.create({
      data: {
        id: sessionId,
        user: { connect: { id: userId } },
        tier: tier.toUpperCase() as any,
        provider: 'local',
        gpuType: tierConfig.gpuOptions[0], // Will be updated after provisioning
        pricePerMinute: tierConfig.pricePerMinute,
        modelId,
        modelName,
        status: 'PENDING',
        wasFreeMinutes: user.freeMinutesRemaining > 0,
      },
    })
    
    // Provision GPU via provider registry
    const provisionResult = await provisionWithBestProvider({
      tier: tier as GpuTier,
      modelId,
      sessionId,
      userId,
    })
    
    if (!provisionResult.success || !provisionResult.instance) {
      // Update session to error status
      await prisma.pumpSession.update({
        where: { id: sessionId },
        data: { status: 'ERROR' },
      })
      
      return res.status(503).json({
        error: 'Failed to provision GPU',
        code: 'PROVISIONING_FAILED',
        message: provisionResult.error || 'No GPU available',
      })
    }
    
    // Update session with provider details
    const updatedSession = await prisma.pumpSession.update({
      where: { id: sessionId },
      data: {
        status: 'PROVISIONING',
        provider: provisionResult.provider,
        providerInstanceId: provisionResult.instance.providerInstanceId,
        gpuType: provisionResult.instance.gpuType,
        gpuCount: provisionResult.instance.gpuCount,
        pricePerMinute: provisionResult.instance.pricePerHour / 60,
      },
    })
    
    res.status(201).json({
      sessionId,
      status: 'provisioning',
      tier,
      tierInfo: {
        name: tierConfig.name,
        description: tierConfig.description,
      },
      gpu: provisionResult.instance.gpuType,
      gpuCount: provisionResult.instance.gpuCount,
      provider: provisionResult.provider,
      modelId: modelId || null,
      modelName: modelName || null,
      pricePerMinute: updatedSession.pricePerMinute,
      estimatedReadySeconds: provisionResult.estimatedReadySeconds || 60,
      accessUrl: null, // Will be available once running
      message: '🚀 Your GPU is warming up!',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors })
    }
    console.error('Create session error:', error)
    res.status(500).json({ error: 'Failed to create session' })
  }
})

// GET /api/sessions/:id - Get session status (requires auth)
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const userId = (req as any).user.userId
    
    // Get session
    const session = await prisma.pumpSession.findFirst({
      where: { id, userId },
      include: {
        metrics: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
    })
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }
    
    // If provisioning/running, get live status from provider
    let liveStatus = null
    if (session.provider && session.providerInstanceId) {
      const provider = providers.getProvider(session.provider)
      if (provider) {
        liveStatus = await provider.getStatus(session.providerInstanceId)
        
        // Update local status if changed
        if (liveStatus && liveStatus.status !== session.status.toLowerCase()) {
          const statusMap: Record<string, any> = {
            'running': 'RUNNING',
            'stopped': 'TERMINATED',
            'error': 'ERROR',
            'provisioning': 'PROVISIONING',
          }
          const newStatus = statusMap[liveStatus.status] || session.status
          
          await prisma.pumpSession.update({
            where: { id },
            data: {
              status: newStatus,
              accessUrl: liveStatus.accessUrl,
              sshHost: liveStatus.sshHost,
              sshPort: liveStatus.sshPort,
              ...(liveStatus.status === 'running' && !session.startedAt ? { startedAt: new Date() } : {}),
            },
          })
        }
      }
    }
    
    // Calculate running time and cost
    let runningMinutes = session.totalMinutes
    let currentCost = session.totalCost
    
    if (session.status === 'RUNNING' && session.startedAt) {
      const now = new Date()
      const start = new Date(session.startedAt)
      runningMinutes = (now.getTime() - start.getTime()) / 60000
      currentCost = runningMinutes * session.pricePerMinute
    }
    
    res.json({
      sessionId: session.id,
      status: session.status.toLowerCase(),
      tier: session.tier.toLowerCase(),
      gpu: session.gpuType,
      gpuCount: session.gpuCount,
      provider: session.provider,
      modelId: session.modelId,
      modelName: session.modelName,
      pricePerMinute: session.pricePerMinute,
      startedAt: session.startedAt,
      runningMinutes: Math.round(runningMinutes * 100) / 100,
      currentCost: Math.round(currentCost * 100) / 100,
      accessUrl: liveStatus?.accessUrl || session.accessUrl,
      sshHost: liveStatus?.sshHost || session.sshHost,
      sshPort: liveStatus?.sshPort || session.sshPort,
      metrics: session.metrics[0] ? {
        gpuUtilization: session.metrics[0].gpuUtilization,
        memoryUsed: session.metrics[0].memoryUsed,
        temperature: session.metrics[0].temperature,
        powerDraw: session.metrics[0].powerDraw,
        timestamp: session.metrics[0].timestamp,
      } : null,
    })
  } catch (error) {
    console.error('Get session error:', error)
    res.status(500).json({ error: 'Failed to get session' })
  }
})

// POST /api/sessions/:id/stop - Stop a session (requires auth)
router.post('/:id/stop', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const userId = (req as any).user.userId
    
    // Get session
    const session = await prisma.pumpSession.findFirst({
      where: { id, userId },
    })
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }
    
    if (session.status === 'TERMINATED') {
      return res.status(400).json({ error: 'Session already terminated' })
    }
    
    // Terminate with provider
    if (session.provider && session.providerInstanceId) {
      const provider = providers.getProvider(session.provider)
      if (provider) {
        await provider.terminate(session.providerInstanceId)
      }
    }
    
    // Calculate final cost
    let finalMinutes = session.totalMinutes
    let finalCost = session.totalCost
    
    if (session.startedAt) {
      const now = new Date()
      const start = new Date(session.startedAt)
      finalMinutes = (now.getTime() - start.getTime()) / 60000
      finalCost = finalMinutes * session.pricePerMinute
    }
    
    // Update session
    const updatedSession = await prisma.pumpSession.update({
      where: { id },
      data: {
        status: 'TERMINATED',
        terminatedAt: new Date(),
        totalMinutes: finalMinutes,
        totalCost: finalCost,
      },
    })
    
    // Deduct from user balance
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (user) {
      // First use free minutes, then credits
      let remainingCost = finalCost
      let freeMinutesUsed = 0
      
      if (session.wasFreeMinutes && user.freeMinutesRemaining > 0) {
        freeMinutesUsed = Math.min(finalMinutes, user.freeMinutesRemaining)
        remainingCost = Math.max(0, finalCost - (freeMinutesUsed * session.pricePerMinute))
      }
      
      await prisma.user.update({
        where: { id: userId },
        data: {
          freeMinutesRemaining: { decrement: freeMinutesUsed },
          creditBalance: { decrement: remainingCost },
        },
      })
    }
    
    res.json({
      sessionId: id,
      status: 'terminated',
      totalMinutes: Math.round(finalMinutes * 100) / 100,
      totalCost: Math.round(finalCost * 100) / 100,
      message: 'Session terminated. Thanks for pumping! 💪',
    })
  } catch (error) {
    console.error('Stop session error:', error)
    res.status(500).json({ error: 'Failed to stop session' })
  }
})

// GET /api/sessions - List user's sessions (requires auth)
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId
    const { status, limit = '20', offset = '0' } = req.query
    
    const where: any = { userId }
    if (status) {
      where.status = status.toString().toUpperCase()
    }
    
    const sessions = await prisma.pumpSession.findMany({
      where,
      orderBy: { requestedAt: 'desc' },
      take: parseInt(limit.toString()),
      skip: parseInt(offset.toString()),
      select: {
        id: true,
        status: true,
        tier: true,
        gpuType: true,
        gpuCount: true,
        provider: true,
        modelName: true,
        pricePerMinute: true,
        totalMinutes: true,
        totalCost: true,
        startedAt: true,
        terminatedAt: true,
        requestedAt: true,
      },
    })
    
    const total = await prisma.pumpSession.count({ where })
    
    res.json({
      sessions: sessions.map(s => ({
        ...s,
        status: s.status.toLowerCase(),
        tier: s.tier.toLowerCase(),
      })),
      total,
      limit: parseInt(limit.toString()),
      offset: parseInt(offset.toString()),
    })
  } catch (error) {
    console.error('List sessions error:', error)
    res.status(500).json({ error: 'Failed to list sessions' })
  }
})

// GET /api/sessions/:id/metrics - Get session metrics (requires auth)
router.get('/:id/metrics', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const userId = (req as any).user.userId
    
    // Verify ownership
    const session = await prisma.pumpSession.findFirst({
      where: { id, userId },
    })
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }
    
    // Try to get live metrics from provider
    let liveMetrics = null
    if (session.provider && session.providerInstanceId && session.status === 'RUNNING') {
      const provider = providers.getProvider(session.provider)
      if (provider) {
        liveMetrics = await provider.getMetrics(session.providerInstanceId)
        
        // Store metrics
        if (liveMetrics) {
          await prisma.sessionMetric.create({
            data: {
              sessionId: id,
              ...liveMetrics,
            },
          })
        }
      }
    }
    
    // If no live metrics, get from database
    if (!liveMetrics) {
      const latestMetric = await prisma.sessionMetric.findFirst({
        where: { sessionId: id },
        orderBy: { timestamp: 'desc' },
      })
      
      if (latestMetric) {
        liveMetrics = {
          gpuUtilization: latestMetric.gpuUtilization,
          memoryUsed: latestMetric.memoryUsed,
          temperature: latestMetric.temperature,
          powerDraw: latestMetric.powerDraw,
        }
      }
    }
    
    res.json({
      sessionId: id,
      metrics: liveMetrics || {
        gpuUtilization: 0,
        memoryUsed: 0,
        temperature: 0,
        powerDraw: 0,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Get metrics error:', error)
    res.status(500).json({ error: 'Failed to get metrics' })
  }
})

export default router
