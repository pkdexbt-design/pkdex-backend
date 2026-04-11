const { Queue } = require('bullmq');
const Redis = require('ioredis');

const connection = new Redis('redis://127.0.0.1:6379');
const orderQueue = new Queue('bot-orders', { connection });

async function addTestOrder() {
  const orderId = 'test-retry-' + Date.now();
  console.log('Adding test order to BullMQ: ' + orderId);
  
  await orderQueue.add(
    'process-order',
    {
      orderId,
      gameVersion: 'scarlet',
      payload: [{ species: 'pikachu', stats: {} }] 
    },
    {
      jobId: orderId,
    }
  );
  
  console.log('Order added successfully. Check backend logs to see it fail and retry.');
  process.exit(0);
}

addTestOrder().catch(console.error);
