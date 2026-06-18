/**
 * Diagnostic script: list the last 5 BullMQ jobs from Redis
 * to see exactly what userPlan was stored in each job.
 */
import { Queue } from 'bullmq';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || process.env.REDIS_PRIVATE_URL || 'redis://localhost:6379';

// Build connection from URL
function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379'),
    password: parsed.password || undefined,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
  };
}

async function main() {
  const connection = parseRedisUrl(REDIS_URL);
  console.log(`Connecting to Redis: ${REDIS_URL.replace(/:\/\/.*@/, '://***@')}`);
  
  const queue = new Queue('bot-orders', { connection });
  
  // Get completed jobs
  const completed = await queue.getCompleted(0, 10);
  const failed = await queue.getFailed(0, 10);
  const waiting = await queue.getWaiting(0, 10);
  const active = await queue.getActive(0, 10);
  
  const allJobs = [...active, ...waiting, ...completed, ...failed]
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, 10);

  console.log(`\n=== Last ${allJobs.length} jobs in queue ===`);
  for (const job of allJobs) {
    const d = job.data;
    const ts = job.timestamp ? new Date(job.timestamp).toISOString() : 'unknown';
    console.log(`Job ID:       ${job.id}`);
    console.log(`Timestamp:    ${ts}`);
    console.log(`Order ID:     ${d?.orderId}`);
    console.log(`Game:         ${d?.gameVersion}`);
    console.log(`userPlan:     ${d?.userPlan}`);
    console.log(`tradeCode:    ${d?.tradeCode}`);
    console.log(`State:        ${await job.getState()}`);
    console.log('---');
  }

  await queue.close();
}

main().catch(console.error);
