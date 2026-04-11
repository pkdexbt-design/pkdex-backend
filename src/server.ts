import dotenv from 'dotenv'
import express from 'express'
import swaggerUi from 'swagger-ui-express'
import { swaggerSpec } from './config/swagger.config'
import { corsMiddleware } from './middleware/cors'
import { authMiddleware } from './middleware/auth'
import validateRouter from './routes/validate'
import ordersRouter from './routes/orders'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 4000

// Global request logger — shows every incoming request before any middleware
app.use((req, res, next) => {
  console.log(`[server] ${req.method} ${req.path} | Origin: ${req.headers.origin ?? 'none'} | Auth: ${req.headers.authorization ? 'Bearer ***' : 'MISSING'}`)
  next()
})

// Middleware
app.use(corsMiddleware)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Swagger documentation routes
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Pokémon SysBot API Docs',
}))

// OpenAPI JSON spec
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.send(swaggerSpec)
})

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check del servidor
 *     description: Verifica que el servidor esté funcionando correctamente
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: Servidor funcionando correctamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthCheckResponse'
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// DiscordBridge status endpoint — for debugging
app.get('/health/discord', (req: express.Request, res: express.Response) => {
  const { discordBridge } = require('./sysbot/DiscordBridge')
  const status = discordBridge.getStatus()
  res.json({
    status: status.connected ? 'connected' : 'disconnected',
    userTag: status.userTag,
    channelId: status.channelId,
    timestamp: new Date().toISOString()
  })
})

// Debug endpoint: Preview the exact Showdown text that would be sent to the bot
app.get('/debug/showdown', (req: express.Request, res: express.Response) => {
  const { buildShowdownText } = require('./lib/showdownBuilder')
  const species = (req.query.species as string) || 'charmander'
  const game = (req.query.game as string) || 'legends-za'
  const ball = (req.query.ball as string) || 'Poké Ball'
  const level = Number(req.query.level) || 50
  
  const mockPayload = {
    species,
    level,
    nature: 'Hardy',
    ability: '',
    shiny: false,
    alpha: false,
    gender: 'genderless',
    heldItem: 'None',
    teraType: 'Normal',
    pokeball: ball,
    origin: 'Wild Encounter',
    moves: [],
    ivs: { hp: 31, attack: 31, defense: 31, spAttack: 31, spDefense: 31, speed: 31 },
    evs: { hp: 0, attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }
  }
  
  const text = buildShowdownText(mockPayload, game)
  res.json({
    game,
    species,
    showdownText: text,
    commandPreview: `!trade 12345678\n${text}`
  })
})

// API Routes
app.use('/api/validate', validateRouter)
app.use('/api/orders', authMiddleware, ordersRouter)

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

import { startTcpServer } from './sysbot/tcpServer'

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`)
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`📚 API Docs: http://localhost:${PORT}/api-docs`)
})

// Start TCP Server for SysBot Connections
const TCP_PORT = Number(process.env.TCP_PORT) || 5005
const tcpServer = startTcpServer(TCP_PORT)

// Start Queue Worker
import './queue/OrderWorker'

// Iniciar Discord Bridge (Cuenta Humana Infiltrada)
import { discordBridge } from './sysbot/DiscordBridge'
const discordToken = process.env.DISCORD_TOKEN
const discordChannelId = process.env.DISCORD_CHANNEL_ID
if (discordToken && discordChannelId) {
  discordBridge.connect(discordToken, discordChannelId)
} else {
  console.warn('⚠️  Discord Bridge no se ha iniciado: faltan DISCORD_TOKEN o DISCORD_CHANNEL_ID en .env')
}

// Graceful shutdown during development (tsx watch / nodemon)
process.once('SIGUSR2', () => {
  tcpServer.close(() => {
    process.kill(process.pid, 'SIGUSR2')
  })
})

process.on('SIGINT', () => {
  tcpServer.close(() => {
    process.exit(0)
  })
})

// Railway sends SIGTERM to stop containers — close TCP socket cleanly so port 5005 is freed
process.on('SIGTERM', () => {
  console.log('[server] SIGTERM received — closing TCP server and exiting...')
  tcpServer.close(() => {
    process.exit(0)
  })
})

export default app
