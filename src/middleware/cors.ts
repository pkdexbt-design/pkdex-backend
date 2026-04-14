import { Request, Response, NextFunction } from 'express'

/**
 * Manual CORS middleware — guarantees Access-Control-* headers are ALWAYS sent,
 * even when the route returns a 4xx/5xx error. The npm `cors` package does not
 * add headers to error responses, so the browser shows "Failed to fetch" instead
 * of the real error.
 *
 * If ALLOWED_ORIGINS contains '*' (or is empty), every origin is reflected back.
 * Otherwise only listed origins receive the header.
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin as string | undefined

  // Always allow credentials and set allowed methods/headers
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (origin) {
    try {
      const raw = process.env.ALLOWED_ORIGINS ?? ''
      const allowedOrigins = raw.split(',').map(s => s.trim()).filter(Boolean)
      const allowAll = allowedOrigins.length === 0 || allowedOrigins.includes('*')

      if (allowAll || allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin)
        res.setHeader('Vary', 'Origin')
      }
    } catch {
      // Safety net: if env parsing blows up, still allow the request
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Vary', 'Origin')
    }
  }

  // Short-circuit OPTIONS preflight — respond 204 before ANY other middleware
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Max-Age', '86400')
    return res.status(204).end()
  }

  next()
}
