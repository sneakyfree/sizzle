/**
 * Authentication Middleware
 * 
 * Verifies JWT tokens and attaches user info to requests.
 * Supports both session tokens and API keys.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  tier: string;
  tokenType: 'session' | 'api_key';
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Require authentication - returns 401 if not authenticated
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  
  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required. Please provide a valid token.',
    });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      email: string;
      tier?: string;
    };
    
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      tier: decoded.tier || 'free',
      tokenType: 'session',
    };
    
    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token.',
    });
  }
}

/**
 * Optional authentication - attaches user if token provided, continues otherwise
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  
  if (!token) {
    return next();
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      email: string;
      tier?: string;
    };
    
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      tier: decoded.tier || 'free',
      tokenType: 'session',
    };
  } catch {
    // Invalid token, but we don't fail - just continue without user
  }
  
  next();
}

/**
 * Require specific tier or higher
 */
export function requireTier(minTier: 'free' | 'starter' | 'pro' | 'enterprise') {
  const tierOrder = ['free', 'starter', 'pro', 'enterprise'];
  
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required.',
      });
    }
    
    const userTierIndex = tierOrder.indexOf(req.user.tier);
    const requiredTierIndex = tierOrder.indexOf(minTier);
    
    if (userTierIndex < requiredTierIndex) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `This feature requires ${minTier} tier or higher. Current: ${req.user.tier}`,
        requiredTier: minTier,
        currentTier: req.user.tier,
      });
    }
    
    next();
  };
}

/**
 * API Key authentication for programmatic access
 */
export async function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key required. Pass via X-API-Key header.',
    });
  }
  
  // API keys start with pm_live_ or pm_test_
  if (!apiKey.startsWith('pm_')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key format.',
    });
  }
  
  // TODO: Look up API key in database, verify it's valid and active
  // For now, accept any properly formatted key in development
  if (process.env.NODE_ENV === 'development') {
    req.user = {
      userId: 'api_user',
      email: 'api@sizzle.io',
      tier: 'pro',
      tokenType: 'api_key',
    };
    return next();
  }
  
  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Invalid API key.',
  });
}

/**
 * Extract token from Authorization header or query param
 */
function extractToken(req: Request): string | null {
  // Check Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  
  // Check query parameter (for WebSocket connections)
  if (typeof req.query.token === 'string') {
    return req.query.token;
  }
  
  return null;
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(user: { userId: string; email: string; tier?: string }): string {
  return jwt.sign(
    {
      userId: user.userId,
      email: user.email,
      tier: user.tier || 'free',
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Generate an API key
 */
export function generateApiKey(isTest: boolean = false): { key: string; prefix: string } {
  const prefix = isTest ? 'pm_test_' : 'pm_live_';
  const randomPart = Array.from({ length: 32 }, () =>
    'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]
  ).join('');
  
  return {
    key: `${prefix}${randomPart}`,
    prefix: prefix + randomPart.slice(0, 8),
  };
}
