/**
 * Health Check Routes
 * 
 * System health, readiness, and status endpoints.
 */

import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import providers from '../providers'

const router = Router()

// GET /api/health - Basic health check
router.get('/', async (req: Request, res: Response) => {
  const start = Date.now()
  
  try {
    // Check database
    await prisma.$queryRaw`SELECT 1`
    const dbLatency = Date.now() - start
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '0.1.0',
      checks: {
        database: { status: 'up', latencyMs: dbLatency },
      },
    })
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Database check failed',
    })
  }
})

// GET /api/health/ready - Kubernetes readiness probe
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`
    
    // Check at least one provider is healthy
    const providerHealth = await providers.getProvidersHealth()
    const anyHealthy = providerHealth.some(p => p.isHealthy)
    
    if (!anyHealthy) {
      return res.status(503).json({
        ready: false,
        reason: 'No healthy GPU providers',
      })
    }
    
    res.json({ ready: true })
  } catch (error) {
    res.status(503).json({
      ready: false,
      reason: error instanceof Error ? error.message : 'System not ready',
    })
  }
})

// GET /api/health/live - Kubernetes liveness probe
router.get('/live', (req: Request, res: Response) => {
  // If we can respond, we're alive
  res.json({ alive: true })
})

// GET /api/health/providers - Detailed provider health
router.get('/providers', async (req: Request, res: Response) => {
  try {
    const health = await providers.getProvidersHealth()
    
    res.json({
      providers: health,
      summary: {
        total: health.length,
        healthy: health.filter(p => p.isHealthy).length,
        unhealthy: health.filter(p => !p.isHealthy).length,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to check provider health' })
  }
})

// GET /api/health/stats - System statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    // Get counts
    const [userCount, sessionCount, activeSessionCount] = await Promise.all([
      prisma.user.count(),
      prisma.pumpSession.count(),
      prisma.pumpSession.count({ where: { status: 'RUNNING' } }),
    ])
    
    res.json({
      stats: {
        totalUsers: userCount,
        totalSessions: sessionCount,
        activeSessions: activeSessionCount,
      },
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats' })
  }
})

export default router
