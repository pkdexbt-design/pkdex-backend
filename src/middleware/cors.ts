import cors from 'cors'

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Read env var lazily — evaluated after dotenv.config() has loaded the .env file
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()) || ['http://localhost:3000']
    const allowAll = allowedOrigins.includes('*')

    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true)

    // Wildcard: allow all origins
    if (allowAll) return callback(null, true)

    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      console.warn(`[CORS] Blocked origin: ${origin} | Allowed: ${allowedOrigins.join(', ')}`)
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
})
