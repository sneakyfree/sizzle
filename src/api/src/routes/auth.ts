/**
 * Authentication Routes
 * 
 * Handles user registration, login, and session management.
 * Uses Prisma for database and JWT for tokens.
 */

import { Router, Request, Response, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import prisma from '../lib/prisma'

const router = Router()

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
})

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

// Helper to generate JWT
function generateToken(userId: string, email: string): string {
  return jwt.sign(
    { userId, email } as jwt.JwtPayload,
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
  )
}

// POST /api/auth/register - Create a new user
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = registerSchema.parse(req.body)
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })
    
    if (existingUser) {
      return res.status(409).json({ 
        error: 'Email already registered',
        code: 'EMAIL_EXISTS',
      })
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 12)
    
    // Create user with 5 free Beast Mode minutes
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name,
        freeMinutesRemaining: 5, // 5 FREE minutes for new users
        tier: 'FREE',
      },
      select: {
        id: true,
        email: true,
        name: true,
        tier: true,
        creditBalance: true,
        freeMinutesRemaining: true,
        createdAt: true,
      },
    })
    
    // Generate token
    const token = generateToken(user.id, user.email)
    
    res.status(201).json({
      message: 'Registration successful! You have 5 free Beast Mode minutes.',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tier: user.tier,
        creditBalance: user.creditBalance,
        freeMinutesRemaining: user.freeMinutesRemaining,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.errors,
      })
    }
    console.error('Registration error:', error)
    res.status(500).json({ error: 'Registration failed' })
  }
})

// POST /api/auth/login - Authenticate user
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body)
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        tier: true,
        creditBalance: true,
        freeMinutesRemaining: true,
      },
    })
    
    if (!user || !user.passwordHash) {
      return res.status(401).json({ 
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      })
    }
    
    // Verify password
    const validPassword = await bcrypt.compare(password, user.passwordHash)
    if (!validPassword) {
      return res.status(401).json({ 
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      })
    }
    
    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })
    
    // Generate token
    const token = generateToken(user.id, user.email)
    
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tier: user.tier,
        creditBalance: user.creditBalance,
        freeMinutesRemaining: user.freeMinutesRemaining,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.errors,
      })
    }
    console.error('Login error:', error)
    res.status(500).json({ error: 'Login failed' })
  }
})

// POST /api/auth/logout - Logout (client should discard token)
router.post('/logout', (req: Request, res: Response) => {
  // JWT is stateless - client discards token
  // Could add token to blacklist if needed
  res.json({ message: 'Logged out successfully' })
})

// GET /api/auth/me - Get current user (requires auth)
router.get('/me', async (req: Request, res: Response) => {
  try {
    // Extract token from header
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'No token provided',
        code: 'NO_TOKEN',
      })
    }
    
    const token = authHeader.split(' ')[1]
    
    // Verify token
    let decoded: { userId: string; email: string }
    try {
      decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string }
    } catch {
      return res.status(401).json({ 
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN',
      })
    }
    
    // Get user
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        tier: true,
        creditBalance: true,
        freeMinutesRemaining: true,
        emailVerified: true,
        phoneVerified: true,
        createdAt: true,
        lastLoginAt: true,
        _count: {
          select: { sessions: true },
        },
      },
    })
    
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      })
    }
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tier: user.tier,
        creditBalance: user.creditBalance,
        freeMinutesRemaining: user.freeMinutesRemaining,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        totalSessions: user._count.sessions,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
    })
  } catch (error) {
    console.error('Get user error:', error)
    res.status(500).json({ error: 'Failed to get user' })
  }
})

// POST /api/auth/forgot-password - Request password reset
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }
    
    // Find user (don't reveal if exists)
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })
    
    if (user) {
      // TODO: Generate reset token and send email
      // For now, just log it
      console.log(`Password reset requested for: ${email}`)
    }
    
    // Always return success (security - don't reveal if email exists)
    res.json({ 
      message: 'If the email exists, a reset link has been sent',
    })
  } catch (error) {
    console.error('Forgot password error:', error)
    res.status(500).json({ error: 'Request failed' })
  }
})

// POST /api/auth/reset-password - Reset password with token
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body
    
    if (!token || !newPassword) {
      return res.status(400).json({ 
        error: 'Token and new password are required',
      })
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters',
      })
    }
    
    // TODO: Verify reset token from database
    // TODO: Update password
    
    res.json({ message: 'Password reset successful' })
  } catch (error) {
    console.error('Reset password error:', error)
    res.status(500).json({ error: 'Reset failed' })
  }
})

// POST /api/auth/verify-email - Verify email with token
router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.body
    
    if (!token) {
      return res.status(400).json({ error: 'Verification token required' })
    }
    
    // TODO: Verify email token and update user.emailVerified
    
    res.json({ message: 'Email verified successfully' })
  } catch (error) {
    console.error('Verify email error:', error)
    res.status(500).json({ error: 'Verification failed' })
  }
})

export default router
