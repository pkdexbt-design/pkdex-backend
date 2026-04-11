import Redis from 'ioredis'

// Redis connection instance shared by BullMQ Queues and Workers
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379'

export const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // Required by BullMQ
})

connection.on('error', (err) => {
  console.error('[Redis] Connection Error:', err)
})

connection.on('ready', () => {
  console.log('[Redis] Connected successfully')
})
