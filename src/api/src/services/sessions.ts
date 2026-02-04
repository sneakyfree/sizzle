/**
 * Session Service
 * 
 * The core business logic for Pump Sessions.
 * Ties together: orchestrator, billing, database, and real-time updates.
 * 
 * This is where the magic happens — normies click, GPUs spin up.
 */

import { orchestrator } from './orchestrator';
import { GPU_TIERS, GpuTier, GpuInstance } from '../types/provider';

// In-memory session store (replace with Prisma in production)
interface SessionRecord {
  id: string;
  userId: string;
  type: 'burst' | 'vpn' | 'home';
  tier: GpuTier;
  modelId?: string;
  
  // Provider info
  provider: string;
  providerInstanceId?: string;
  instance?: GpuInstance;
  
  // Status
  status: 'pending' | 'provisioning' | 'ready' | 'active' | 'paused' | 'terminated';
  
  // Timing (all timestamps)
  requestedAt: Date;
  provisionedAt?: Date;
  startedAt?: Date;
  pausedAt?: Date;
  terminatedAt?: Date;
  
  // Billing
  pricePerMinute: number;
  totalMinutes: number;
  totalCost: number; // In cents
  lastBilledAt?: Date;
  
  // Access
  accessUrl?: string;
}

const sessions = new Map<string, SessionRecord>();

// Billing interval tracker
const billingIntervals = new Map<string, NodeJS.Timeout>();

/**
 * Create a new Pump Session
 */
export async function createSession(params: {
  userId: string;
  type?: 'burst' | 'vpn' | 'home';
  tier: GpuTier;
  modelId?: string;
  estimatedMinutes?: number;
}): Promise<{
  success: boolean;
  session?: SessionRecord;
  error?: string;
}> {
  const { userId, type = 'burst', tier, modelId } = params;
  
  // Validate tier
  const tierConfig = GPU_TIERS[tier];
  if (!tierConfig) {
    return { success: false, error: `Invalid tier: ${tier}` };
  }
  
  // Generate session ID
  const sessionId = `pump_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  // Create session record
  const session: SessionRecord = {
    id: sessionId,
    userId,
    type,
    tier,
    modelId,
    provider: 'pending',
    status: 'pending',
    requestedAt: new Date(),
    pricePerMinute: tierConfig.pricePerMinute * 100, // Convert to cents
    totalMinutes: 0,
    totalCost: 0,
  };
  
  sessions.set(sessionId, session);
  
  // Request provisioning from orchestrator
  session.status = 'provisioning';
  
  const provisionResult = await orchestrator.provisionSession({
    sessionId,
    userId,
    tier,
    modelId,
  });
  
  if (!provisionResult.success) {
    session.status = 'terminated';
    session.terminatedAt = new Date();
    return { success: false, error: provisionResult.error };
  }
  
  // Update session with provider info
  session.provider = provisionResult.instance!.provider;
  session.providerInstanceId = provisionResult.instance!.providerInstanceId;
  session.instance = provisionResult.instance;
  session.accessUrl = provisionResult.instance!.accessUrl;
  session.status = 'ready';
  session.provisionedAt = new Date();
  
  return { success: true, session };
}

/**
 * Start a session (begin billing)
 */
export async function startSession(sessionId: string, userId: string): Promise<{
  success: boolean;
  session?: SessionRecord;
  error?: string;
}> {
  const session = sessions.get(sessionId);
  
  if (!session) {
    return { success: false, error: 'Session not found' };
  }
  
  if (session.userId !== userId) {
    return { success: false, error: 'Unauthorized' };
  }
  
  if (session.status !== 'ready' && session.status !== 'paused') {
    return { success: false, error: `Cannot start session in status: ${session.status}` };
  }
  
  session.status = 'active';
  session.startedAt = session.startedAt || new Date();
  session.lastBilledAt = new Date();
  
  // Start billing interval (every minute)
  startBillingInterval(sessionId);
  
  return { success: true, session };
}

/**
 * Stop a session (end billing, cleanup)
 */
export async function stopSession(sessionId: string, userId: string): Promise<{
  success: boolean;
  session?: SessionRecord;
  finalCost?: number;
  error?: string;
}> {
  const session = sessions.get(sessionId);
  
  if (!session) {
    return { success: false, error: 'Session not found' };
  }
  
  if (session.userId !== userId) {
    return { success: false, error: 'Unauthorized' };
  }
  
  if (session.status === 'terminated') {
    return { success: false, error: 'Session already terminated' };
  }
  
  // Stop billing
  stopBillingInterval(sessionId);
  
  // Calculate final bill
  if (session.lastBilledAt && session.status === 'active') {
    const now = new Date();
    const minutesSinceLastBill = Math.ceil(
      (now.getTime() - session.lastBilledAt.getTime()) / 60000
    );
    session.totalMinutes += minutesSinceLastBill;
    session.totalCost += minutesSinceLastBill * session.pricePerMinute;
  }
  
  // Terminate provider instance
  if (session.provider !== 'pending') {
    await orchestrator.terminateSession(sessionId, session.provider);
  }
  
  session.status = 'terminated';
  session.terminatedAt = new Date();
  
  return {
    success: true,
    session,
    finalCost: session.totalCost,
  };
}

/**
 * Pause a session (VPN only)
 */
export async function pauseSession(sessionId: string, userId: string): Promise<{
  success: boolean;
  session?: SessionRecord;
  error?: string;
}> {
  const session = sessions.get(sessionId);
  
  if (!session) {
    return { success: false, error: 'Session not found' };
  }
  
  if (session.userId !== userId) {
    return { success: false, error: 'Unauthorized' };
  }
  
  if (session.type !== 'vpn') {
    return { success: false, error: 'Only VPN sessions can be paused' };
  }
  
  if (session.status !== 'active') {
    return { success: false, error: `Cannot pause session in status: ${session.status}` };
  }
  
  // Stop billing during pause
  stopBillingInterval(sessionId);
  
  // Bill for time since last billing
  if (session.lastBilledAt) {
    const now = new Date();
    const minutesSinceLastBill = Math.ceil(
      (now.getTime() - session.lastBilledAt.getTime()) / 60000
    );
    session.totalMinutes += minutesSinceLastBill;
    session.totalCost += minutesSinceLastBill * session.pricePerMinute;
  }
  
  session.status = 'paused';
  session.pausedAt = new Date();
  
  return { success: true, session };
}

/**
 * Get session by ID
 */
export function getSession(sessionId: string): SessionRecord | undefined {
  return sessions.get(sessionId);
}

/**
 * Get all sessions for a user
 */
export function getUserSessions(userId: string): SessionRecord[] {
  return Array.from(sessions.values())
    .filter(s => s.userId === userId)
    .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
}

/**
 * Get active session count
 */
export function getActiveSessionCount(): number {
  return Array.from(sessions.values()).filter(
    s => s.status === 'active' || s.status === 'ready'
  ).length;
}

/**
 * Get session metrics
 */
export async function getSessionMetrics(sessionId: string, userId: string) {
  const session = sessions.get(sessionId);
  
  if (!session || session.userId !== userId) {
    return null;
  }
  
  if (session.provider === 'pending') {
    return null;
  }
  
  return orchestrator.getSessionMetrics(sessionId, session.provider);
}

// =============================================================================
// BILLING HELPERS
// =============================================================================

function startBillingInterval(sessionId: string) {
  // Clear any existing interval
  stopBillingInterval(sessionId);
  
  // Bill every minute
  const interval = setInterval(() => {
    const session = sessions.get(sessionId);
    if (!session || session.status !== 'active') {
      stopBillingInterval(sessionId);
      return;
    }
    
    session.totalMinutes += 1;
    session.totalCost += session.pricePerMinute;
    session.lastBilledAt = new Date();
    
    console.log(
      `💰 Billed ${session.id}: +$${(session.pricePerMinute / 100).toFixed(2)} ` +
      `(Total: ${session.totalMinutes} min, $${(session.totalCost / 100).toFixed(2)})`
    );
  }, 60000); // Every minute
  
  billingIntervals.set(sessionId, interval);
}

function stopBillingInterval(sessionId: string) {
  const interval = billingIntervals.get(sessionId);
  if (interval) {
    clearInterval(interval);
    billingIntervals.delete(sessionId);
  }
}

// =============================================================================
// STATS & ADMIN
// =============================================================================

export function getStats() {
  const allSessions = Array.from(sessions.values());
  
  return {
    totalSessions: allSessions.length,
    activeSessions: allSessions.filter(s => s.status === 'active').length,
    readySessions: allSessions.filter(s => s.status === 'ready').length,
    terminatedSessions: allSessions.filter(s => s.status === 'terminated').length,
    totalMinutes: allSessions.reduce((sum, s) => sum + s.totalMinutes, 0),
    totalRevenue: allSessions.reduce((sum, s) => sum + s.totalCost, 0),
    byTier: {
      starter: allSessions.filter(s => s.tier === 'starter').length,
      pro: allSessions.filter(s => s.tier === 'pro').length,
      beast: allSessions.filter(s => s.tier === 'beast').length,
      ultra: allSessions.filter(s => s.tier === 'ultra').length,
    },
  };
}

export const sessionService = {
  createSession,
  startSession,
  stopSession,
  pauseSession,
  getSession,
  getUserSessions,
  getActiveSessionCount,
  getSessionMetrics,
  getStats,
};
