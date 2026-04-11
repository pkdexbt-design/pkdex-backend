const { Queue } = require('bullmq');
const Redis = require('ioredis');

const connection = new Redis('redis://127.0.0.1:6379');
const orderQueue = new Queue('bot-orders', { connection });

async function addTestOrder() {
  const orderId = 'test-retry-valid-' + Date.now();
  console.log('Adding valid test order to BullMQ: ' + orderId);
  
  await orderQueue.add(
    'process-order',
    {
      orderId,
      gameVersion: 'scarlet',
      payload: [{
        species: 'pikachu',
        level: 100,
        nature: 'timid',
        ability: 'static',
        shiny: false,
        gender: 'male',
        heldItem: 'Light Ball',
        teraType: 'electric',
        pokeball: 'Poké Ball',
        moves: ['thunder-punch', 'quick-attack', 'iron-tail', 'volt-tackle'],
        ivs: { hp: 31, attack: 31, defense: 31, spatk: 31, spdef: 31, speed: 31 },
        evs: { hp: 0, attack: 0, defense: 0, spatk: 252, spdef: 4, speed: 252 }
      }]
    },
    {
      jobId: orderId,
    }
  );
  
  console.log('Valid order added successfully.');
  process.exit(0);
}

addTestOrder().catch(console.error);
