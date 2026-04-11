import { Request, Response, NextFunction } from 'express'
import { getSupabase } from '../lib/supabase'

export interface AuthRequest extends Request {
  user?: {
    id: string
    email: string
    /** 'free' | 'premium' — defaults to 'free' if not set */
    plan: 'free' | 'premium'
  }
}

/**
 * Middleware to verify Supabase access tokens.
 * Uses supabase.auth.getUser() so the token is validated against
 * the same Supabase project the frontend uses — no separate JWT_SECRET needed.
 */
export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization
    console.log('[auth] Headers received:', Object.keys(req.headers).join(', '))
    console.log('[auth] Authorization header present:', !!authHeader)

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[auth] FAIL: No Bearer token in Authorization header')
      return res.status(401).json({ error: 'No token provided' })
    }

    const token = authHeader.substring(7)
    console.log('[auth] Token prefix (first 30 chars):', token.substring(0, 30) + '...')
    console.log('[auth] SUPABASE_URL being used:', process.env.SUPABASE_URL)

    const supabase = getSupabase()
    console.log('[auth] Calling supabase.auth.getUser()...')
    const { data: { user }, error } = await supabase.auth.getUser(token)

    console.log('[auth] getUser result — user:', user?.id ?? 'null', '| error:', error?.message ?? 'none')

    if (error || !user) {
      console.log('[auth] FAIL: Token invalid or expired. Error:', error?.message)
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    req.user = {
      id: user.id,
      email: user.email ?? '',
      plan: (user.app_metadata?.plan === 'premium') ? 'premium' : 'free',
    }
    console.log('[auth] SUCCESS: Authenticated user', user.id, '| plan:', req.user.plan)

    next()
  } catch (error) {
    console.error('[authMiddleware] Unexpected error:', error)
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

/**
 * Optional auth middleware - doesn't fail if no token is provided.
 */
export async function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser(token)
      if (user) {
        req.user = {
          id: user.id,
          email: user.email ?? '',
          plan: (user.app_metadata?.plan === 'premium') ? 'premium' : 'free',
        }
      }
    }
  } catch {
    // Silently fail for optional auth
  }

  next()
}
