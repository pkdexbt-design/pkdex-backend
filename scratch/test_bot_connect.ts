import dotenv from 'dotenv';
import { Client, Intents } from 'discord.js-selfbot-v13';

dotenv.config();

async function run() {
  const token = process.env.DISCORD_TOKEN?.trim();
  const isBot = process.env.DISCORD_IS_BOT === 'true';
  
  if (!token) {
    console.error('No DISCORD_TOKEN defined.');
    return;
  }
  
  console.log('Testing connection...');
  console.log('Token starts with:', token.substring(0, 15));
  console.log('isBot:', isBot);
  
  const clientOptions: any = {};
  if (isBot) {
    clientOptions.intents = [
      Intents.FLAGS.GUILDS,
      Intents.FLAGS.GUILD_MESSAGES,
      Intents.FLAGS.DIRECT_MESSAGES,
      Intents.FLAGS.MESSAGE_CONTENT
    ];
  }
  
  const client = new Client(clientOptions);
  
  client.on('ready', () => {
    console.log('✅ Connected successfully as:', client.user?.tag);
    client.destroy();
  });
  
  try {
    await client.login(token);
  } catch (err) {
    console.error('❌ Login failed with error:', err);
  }
}

run();
