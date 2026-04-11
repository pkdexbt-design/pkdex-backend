import { Queue } from 'bullmq'
import { connection } from './redis'

export const ORDER_QUEUE_NAME = 'bot-orders'

// Create a new Queue instance
export const orderQueue = new Queue(ORDER_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5s, 10s, 20s...
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 500,     // Keep last 500 failed jobs
  }
})

/**
 * Add a new Trade Order to the queue
 */
export async function addOrderToQueue(orderId: string, gameVersion: string, payload: any, tradeCode: string) {
  console.log(`[OrderQueue] Adding order ${orderId} to queue for game ${gameVersion}`)
  
  await orderQueue.add(
    'process-order',
    { orderId, gameVersion, payload, tradeCode },
    {
      jobId: orderId, // Prevent duplicate jobs for the same order
    }
  )
}
