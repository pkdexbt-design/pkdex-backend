import { ordersStore, updateOrderState } from '../routes/publicOrders';

class DiscordBridgeService {
  private client: any;
  private isConnected: boolean = false;
  private targetChannelId: string | null = null;
  private savedToken: string | null = null;
  private activeOrdersByChannel = new Map<string, string>();

  constructor() {
    this.client = this.createClient();
    this.setupListeners();
  }

  private createClient(): any {
    const isBot = process.env.DISCORD_IS_BOT === 'true';
    if (isBot) {
      console.log('[DiscordBridge] Instantiating official discord.js client (isBot: true)...');
      const { Client: BotClient, GatewayIntentBits } = require('discord.js');
      return new BotClient({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.DirectMessages,
          GatewayIntentBits.MessageContent
        ]
      });
    } else {
      console.log('[DiscordBridge] Instantiating discord.js-selfbot-v13 client (isBot: false)...');
      const { Client: SelfClient } = require('discord.js-selfbot-v13');
      return new SelfClient();
    }
  }

  private setupListeners() {
    this.client.on('ready', () => {
      console.log(`[DiscordBridge] ✅ Logged in as: ${this.client.user?.tag}`);
      this.isConnected = true;
    });

    this.client.on('error', (error: any) => {
      console.error('[DiscordBridge] Connection error:', error);
      this.isConnected = false;
      // Intentamos reconectar en 10 segundos si tenemos el token
      if (this.savedToken) {
        console.log('[DiscordBridge] Trying to reconnect in 10 seconds...');
        setTimeout(() => this.reconnect(), 10_000);
      }
    });

    // Si el cliente cierra la sesión inesperadamente, reconectamos
    this.client.on('shardDisconnect' as any, () => {
      console.warn('[DiscordBridge] ⚠️  Disconnected from Discord.');
      this.isConnected = false;
      if (this.savedToken) {
        console.log('[DiscordBridge] Scheduling reconnect in 15 seconds...');
        setTimeout(() => this.reconnect(), 15_000);
      }
    });

    // Listener para parsear mensajes del bot en el canal
    this.client.on('messageCreate', async (message: any) => {
      try {
        await this.handleIncomingMessage(message);
      } catch (err) {
        console.error('[DiscordBridge] Error in messageCreate listener:', err);
      }
    });
  }

  private async reconnect() {
    if (this.isConnected) return; // ya se reconectó
    if (!this.savedToken) return;
    try {
      console.log('[DiscordBridge] Reconnecting...');
      // Destroy old client and create a fresh one
      try { this.client.destroy() } catch {}
      this.client = this.createClient();
      this.setupListeners();
      await this.client.login(this.savedToken);
    } catch (err) {
      console.error('[DiscordBridge] Reconnect failed:', err);
      setTimeout(() => this.reconnect(), 30_000);
    }
  }

  public async connect(token: string, targetChannelId: string) {
    this.targetChannelId = targetChannelId;
    this.savedToken = token;
    if (this.isConnected) return;
    
    try {
      console.log('[DiscordBridge] Connecting with token...');
      await this.client.login(token);
    } catch (error) {
      console.error('[DiscordBridge] Failed to login:', error);
      this.isConnected = false;
      // Retry in 30 seconds on initial connect failure
      setTimeout(() => this.reconnect(), 30_000);
    }
  }

  public async sendTradeCommand(
    showdownText: string,
    tradeCode: string,
    overrideChannelId?: string,
    prefix: string = '!',
    attachment?: { buffer: Buffer; filename: string }
  ): Promise<boolean> {
    const activeChannelId = overrideChannelId || this.targetChannelId;

    if (!activeChannelId) {
      console.error('[DiscordBridge] No target channel specified.');
      return false;
    }

    const formattedCode = tradeCode.replace(/\s/g, ''); // Remove spaces: "1234 5678" -> "12345678"
    const commandText = attachment
      ? `${prefix}trade ${formattedCode}`
      : `${prefix}trade ${formattedCode}\n${showdownText}`;

    // 1. PRIMARY METHOD: HTTP REST Request (Bypasses WebSocket blocking issues on Railway)
    if (this.savedToken) {
      try {
        console.log(`[DiscordBridge] Sending HTTP request to channel ${activeChannelId}...`);
        
        const isBot = process.env.DISCORD_IS_BOT === 'true';
        const authHeader = isBot ? `Bot ${this.savedToken}` : this.savedToken;

        let response;
        if (attachment) {
          const formData = new FormData();
          formData.append('payload_json', JSON.stringify({
            content: commandText
          }));
          const blob = new Blob([new Uint8Array(attachment.buffer)]);
          formData.append('files[0]', blob, attachment.filename);

          response = await fetch(`https://discord.com/api/v9/channels/${activeChannelId}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': authHeader
            },
            body: formData
          });
        } else {
          response = await fetch(`https://discord.com/api/v9/channels/${activeChannelId}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              content: commandText
            })
          });
        }

        if (response.ok) {
          console.log('[DiscordBridge] ✅ Command sent via HTTP REST!');
          return true;
        } else {
          console.error(`[DiscordBridge] HTTP send failed with status: ${response.status} ${response.statusText}`);
          const text = await response.text();
          console.error(`[DiscordBridge] HTTP response body: ${text}`);
        }
      } catch (error) {
        console.error('[DiscordBridge] HTTP send error:', error);
      }
    }

    // 2. FALLBACK METHOD: WebSocket
    // Wait up to 20 seconds for the connection to be ready
    if (!this.isConnected) {
      console.warn('[DiscordBridge] Not connected via WebSocket, waiting up to 20s...');
      const waited = await this.waitForConnection(20_000);
      if (!waited) {
        console.error('[DiscordBridge] Cannot send command: failed to connect in time.');
        return false;
      }
    }

    try {
      const channel = await this.client.channels.fetch(activeChannelId);
      if (channel && (typeof channel.isText === 'function' ? channel.isText() : (channel as any).isTextBased())) {
        console.log(`[DiscordBridge] Sending via WebSocket to channel ${activeChannelId}:\n${commandText}`);
        if (attachment) {
          await (channel as any).send({
            content: commandText,
            files: [{
              attachment: attachment.buffer,
              name: attachment.filename
            }]
          });
        } else {
          await (channel as any).send(commandText);
        }
        console.log('[DiscordBridge] ✅ Command sent via WebSocket!');
        return true;
      } else {
        console.error(`[DiscordBridge] Channel ${activeChannelId} not found or is not a text channel.`);
        return false;
      }
    } catch (error) {
      console.error('[DiscordBridge] Error sending command via WebSocket:', error);
      return false;
    }
  }

  /** Polls for isConnected to become true, up to timeoutMs. */
  private waitForConnection(timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const interval = 500;
      let elapsed = 0;
      const check = setInterval(() => {
        if (this.isConnected) {
          clearInterval(check);
          resolve(true);
        } else {
          elapsed += interval;
          if (elapsed >= timeoutMs) {
            clearInterval(check);
            resolve(false);
          }
        }
      }, interval);
    });
  }

  private getGameForChannel(channelId: string): 'sv' | 'za' | null {
    const svChannels = [
      process.env.DISCORD_CHANNEL_ID_SV,
      process.env.DISCORD_CHANNEL_ID_SV_FREE,
      process.env.DISCORD_CHANNEL_ID_SV_PREMIUM
    ].map(id => id?.replace(/[^0-9]/g, '')).filter(Boolean);

    const zaChannels = [
      process.env.DISCORD_CHANNEL_ID_ZA,
      process.env.DISCORD_CHANNEL_ID_ZA_FREE,
      process.env.DISCORD_CHANNEL_ID_ZA_PREMIUM
    ].map(id => id?.replace(/[^0-9]/g, '')).filter(Boolean);

    if (svChannels.includes(channelId)) return 'sv';
    if (zaChannels.includes(channelId)) return 'za';
    return null;
  }

  private getTargetChannels(): string[] {
    const channels = new Set<string>();
    if (this.targetChannelId) channels.add(this.targetChannelId.replace(/[^0-9]/g, ''));
    if (process.env.DISCORD_CHANNEL_ID_SV) channels.add(process.env.DISCORD_CHANNEL_ID_SV.replace(/[^0-9]/g, ''));
    if (process.env.DISCORD_CHANNEL_ID_SV_FREE) channels.add(process.env.DISCORD_CHANNEL_ID_SV_FREE.replace(/[^0-9]/g, ''));
    if (process.env.DISCORD_CHANNEL_ID_SV_PREMIUM) channels.add(process.env.DISCORD_CHANNEL_ID_SV_PREMIUM.replace(/[^0-9]/g, ''));
    if (process.env.DISCORD_CHANNEL_ID_ZA_FREE) channels.add(process.env.DISCORD_CHANNEL_ID_ZA_FREE.replace(/[^0-9]/g, ''));
    if (process.env.DISCORD_CHANNEL_ID_ZA_PREMIUM) channels.add(process.env.DISCORD_CHANNEL_ID_ZA_PREMIUM.replace(/[^0-9]/g, ''));
    if (process.env.DISCORD_CHANNEL_ID_ZA) channels.add(process.env.DISCORD_CHANNEL_ID_ZA.replace(/[^0-9]/g, ''));
    if (process.env.DISCORD_CHANNEL_ID) channels.add(process.env.DISCORD_CHANNEL_ID.replace(/[^0-9]/g, ''));
    return Array.from(channels).filter(Boolean);
  }

  private async handleIncomingMessage(message: any) {
    // 1. Ignore own messages
    if (message.author.id === this.client.user?.id) return;

    // 2. Validate channel is one of the target channels
    const targetChannels = this.getTargetChannels();
    if (!targetChannels.includes(message.channel.id)) return;

    const content = message.content || '';
    if (!content) return;

    // Ignore user commands (starting with !, %, $, &, /, ?, +, -)
    const trimmed = content.trim();
    if (/^[!%$&\/?+\-]/.test(trimmed)) {
      return;
    }

    // 3. Scan for 8-digit trade code (e.g. 1234 5678, 1234-5678, or 12345678)
    const codeRegex = /\b(\d{4})[\s-]?(\d{4})\b/g;
    let match;
    let parsedCode: string | null = null;
    
    if ((match = codeRegex.exec(content)) !== null) {
      parsedCode = (match[1] + match[2]).replace(/[^0-9]/g, '');
    }

    const contentLower = content.toLowerCase();
    
    // Parse status based on strict bot-like keywords/patterns
    const isQueued = [
      'added to the linktrade queue',
      'added to the queue',
      'queue position',
      'añadido a la cola'
    ].some(keyword => contentLower.includes(keyword)) ||
    /position\s*\d+/i.test(contentLower) ||
    /posici[oó]n\s*\d+/i.test(contentLower);

    const isPreparing = [
      'preparing your trade',
      'initializing trade',
      'preparando intercambio',
      'starting next trade'
    ].some(keyword => contentLower.includes(keyword));

    const isCompleted = [
      'trade completed',
      'transaction complete',
      'enjoy your pokemon',
      'disfruta de tu pok',
      'intercambio completado',
      'trade finished',
      'enjoy your'
    ].some(keyword => contentLower.includes(keyword));

    const isFailed = [
      'could not find partner',
      'notrainerfound',
      'no trainer found',
      'couldn\'t find',
      'no partner found',
      'no se encontr',
      'trade cancelled',
      'trade canceled',
      'trade timed out',
      'timed out',
      'se agotó el tiempo',
      'intercambio falló'
    ].some(keyword => contentLower.includes(keyword));

    // Prevent preparing/initializing trade message from triggering searching status prematurely
    const isSearching = !isPreparing && (
      [
        'searching on',
        'searching with code',
        'waiting for trainer',
        'waiting for you',
        'introduce el código',
        'inicia el intercambio',
        'esperando al entrenador',
        'buscando con el código',
        'esperándote',
        'esperandote'
      ].some(keyword => contentLower.includes(keyword)) ||
      (contentLower.includes('now searching') && parsedCode) ||
      (contentLower.includes('código') && parsedCode) ||
      (contentLower.includes('codigo') && parsedCode) ||
      (contentLower.includes('code is') && parsedCode)
    );

    const isTrading = [
      'trade in progress',
      'intercambio en curso',
      'connected to trainer',
      'trading with'
    ].some(keyword => contentLower.includes(keyword));

    // Extract Pokemon name if present in message
    let pokemonName: string | null = null;
    const receivingMatch = /receiving:\s*([a-z0-9\-'\s]+?)(?:\.|$)/i.exec(content);
    if (receivingMatch) {
      pokemonName = receivingMatch[1].trim().toLowerCase();
    } else {
      const tradeInitMatch = /trade\s*\(([^)]+)\)/i.exec(content);
      if (tradeInitMatch) {
        pokemonName = tradeInitMatch[1].trim().toLowerCase();
      }
    }

    let matchedOrderId: string | null = null;
    let matchedOrder: any = null;

    // A. Match by trade code (most specific)
    if (parsedCode) {
      for (const [id, record] of ordersStore.entries()) {
        const recordCode = record.tradeCode?.replace(/[^0-9]/g, '');
        if (recordCode === parsedCode && record.status !== 'completed' && record.status !== 'failed' && record.status !== 'expired') {
          matchedOrderId = id;
          matchedOrder = record;
          break;
        }
      }
      if (matchedOrderId) {
        this.activeOrdersByChannel.set(message.channel.id, matchedOrderId);
        console.log(`[DiscordBridge] 🔍 Matched order ${matchedOrderId} by trade code ${parsedCode} in channel ${message.channel.id}`);
      }
    }

    // B. Match by Pokemon name in pending/active orders (specific)
    if (!matchedOrderId && pokemonName) {
      let bestOrderId: string | null = null;
      let latestTime = 0;

      for (const [id, record] of ordersStore.entries()) {
        if (record.status === 'completed' || record.status === 'failed' || record.status === 'expired' || record.status === 'partial_failed') {
          continue;
        }

        const channelGame = this.getGameForChannel(message.channel.id);
        if (channelGame && record.game !== channelGame) continue;

        const matchesPokemon = record.items.some((it: any) => 
          String(it.displayName || '').toLowerCase() === pokemonName ||
          String(it.species || '').toLowerCase() === pokemonName
        );

        if (matchesPokemon) {
          const createdAtTime = record.createdAt ? new Date(record.createdAt).getTime() : 0;
          if (createdAtTime > latestTime) {
            latestTime = createdAtTime;
            bestOrderId = id;
          }
        }
      }

      if (bestOrderId) {
        matchedOrderId = bestOrderId;
        matchedOrder = ordersStore.get(bestOrderId);
        this.activeOrdersByChannel.set(message.channel.id, matchedOrderId);
        console.log(`[DiscordBridge] 🔍 Matched order ${matchedOrderId} by Pokemon name "${pokemonName}" in channel ${message.channel.id}`);
      }
    }

    // C. Fallback: Reuse active order for channel (least specific)
    if (!matchedOrderId) {
      const savedOrderId = this.activeOrdersByChannel.get(message.channel.id);
      if (savedOrderId && ordersStore.has(savedOrderId)) {
        const record = ordersStore.get(savedOrderId);
        if (record.status !== 'completed' && record.status !== 'failed' && record.status !== 'expired' && record.status !== 'partial_failed') {
          matchedOrderId = savedOrderId;
          matchedOrder = record;
          console.log(`[DiscordBridge] 🔗 Reused active order ${matchedOrderId} for channel ${message.channel.id} (fallback)`);
        }
      }
    }

    if (!matchedOrder || !matchedOrderId) return;

    // Update trade code if different
    if (parsedCode && matchedOrder.tradeCode?.replace(/[^0-9]/g, '') !== parsedCode) {
      console.log(`[DiscordBridge] 🔄 Updating tradeCode for order ${matchedOrderId} to ${parsedCode}`);
      matchedOrder.tradeCode = parsedCode;
      try {
        const { getSupabase } = require('../lib/supabase');
        const supabase = getSupabase();
        await supabase
          .from('orders')
          .update({ trade_code: parsedCode })
          .eq('id', matchedOrderId);
      } catch (dbErr: any) {
        console.error(`[DiscordBridge] Failed to update trade_code in Supabase for ${matchedOrderId}:`, dbErr.message || dbErr);
      }
    }

    const items = matchedOrder.items ? [...matchedOrder.items] : [];

    if (isFailed) {
      console.log(`[DiscordBridge] Order ${matchedOrderId} marked as FAILED`);
      const hasCompletedAny = items.some(it => ['completed', 'delivered', 'done'].includes(String(it.status || '').toLowerCase()));
      const nextStatus = hasCompletedAny ? 'partial_failed' : 'failed';
      
      const updatedItems = items.map(it => {
        if (!['completed', 'delivered', 'done', 'failed'].includes(String(it.status || '').toLowerCase())) {
          return { ...it, status: 'failed' };
        }
        return it;
      });

      await updateOrderState(matchedOrderId, {
        status: nextStatus,
        message: `El intercambio falló o se interrumpió. Mensaje: "${content}"`,
        items: updatedItems
      });

      // Clear active order mapping
      this.activeOrdersByChannel.delete(message.channel.id);
    }
    else if (isCompleted) {
      console.log(`[DiscordBridge] Order ${matchedOrderId} completed a trade`);

      let updatedItems = [...items];
      let matchedItemIndex = -1;

      if (items.length > 1) {
        // Check which pending item matches species/displayName in the message
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          const isPending = !['completed', 'delivered', 'done', 'failed'].includes(String(it.status || '').toLowerCase());
          if (isPending) {
            const nameLower = String(it.displayName || '').toLowerCase();
            const speciesLower = String(it.species || '').toLowerCase();
            if ((nameLower && contentLower.includes(nameLower)) || (speciesLower && contentLower.includes(speciesLower))) {
              matchedItemIndex = i;
              break;
            }
          }
        }

        // Fallback to first pending item if no name matches
        if (matchedItemIndex === -1) {
          matchedItemIndex = items.findIndex(it => !['completed', 'delivered', 'done', 'failed'].includes(String(it.status || '').toLowerCase()));
        }

        if (matchedItemIndex !== -1) {
          updatedItems[matchedItemIndex] = { ...updatedItems[matchedItemIndex], status: 'completed' };
          console.log(`[DiscordBridge] Marked item ${updatedItems[matchedItemIndex].displayName} as completed`);
        }
      } else if (items.length === 1) {
        updatedItems[0] = { ...updatedItems[0], status: 'completed' };
      }

      const allDone = updatedItems.every(it => ['completed', 'delivered', 'done', 'failed'].includes(String(it.status || '').toLowerCase()));
      
      if (allDone) {
        const hasFailedAny = updatedItems.some(it => String(it.status || '').toLowerCase() === 'failed');
        const finalStatus = hasFailedAny ? 'partial_failed' : 'completed';
        const finalMessage = hasFailedAny ? 'Entrega finalizada con algunos fallos.' : '¡Intercambio completado con éxito!';

        await updateOrderState(matchedOrderId, {
          status: finalStatus,
          message: finalMessage,
          items: updatedItems
        });

        // Clear active order mapping since order completed
        this.activeOrdersByChannel.delete(message.channel.id);
      } else {
        const msg = matchedItemIndex !== -1 
          ? `Entregado: ${updatedItems[matchedItemIndex].displayName}. Preparando siguiente Pokémon...`
          : `Pokémon entregado. Esperando el siguiente del lote...`;

        await updateOrderState(matchedOrderId, {
          status: 'trading',
          message: msg,
          items: updatedItems
        });
      }
    }
    else if (isTrading) {
      console.log(`[DiscordBridge] Order ${matchedOrderId} status updated to trading`);
      await updateOrderState(matchedOrderId, {
        status: 'trading',
        message: 'Intercambio en curso con el bot. Por favor, no cierres esta pantalla.'
      });
    }
    else if (isSearching) {
      console.log(`[DiscordBridge] Order ${matchedOrderId} status updated to searching`);
      let queuePosition: number | undefined;
      const posMatch = /posici(?:o|ó)n\s*(\d+)/i.exec(content);
      if (posMatch) {
        queuePosition = parseInt(posMatch[1], 10);
      }

      await updateOrderState(matchedOrderId, {
        status: 'searching',
        message: 'Introduce el código ahora e inicia el intercambio en tu juego.',
        queuePosition
      });
    }
    else if (isPreparing) {
      console.log(`[DiscordBridge] Order ${matchedOrderId} status updated to preparing`);
      await updateOrderState(matchedOrderId, {
        status: 'preparing',
        message: 'El bot está preparando el intercambio. Por favor, mantente atento.'
      });
    }
    else if (isQueued) {
      console.log(`[DiscordBridge] Order ${matchedOrderId} status updated to queued`);
      let queuePosition: number | undefined;
      const posMatch = /posici(?:o|ó)n\s*(\d+)|position\s*(\d+)/i.exec(content);
      if (posMatch) {
        queuePosition = parseInt(posMatch[1] || posMatch[2], 10);
      }

      let estimatedTime: string | undefined;
      const estMatch = /(?:estimated|estimado|espera):\s*([\d,.]+)\s*(?:minutes|minutos|min)/i.exec(content);
      if (estMatch) {
        estimatedTime = `${estMatch[1]} minutos`;
      } else {
        const fallbackMatch = /([\d,.]+)\s*(?:minutes|minutos|min)/i.exec(content);
        if (fallbackMatch) {
          estimatedTime = `${fallbackMatch[1]} minutos`;
        }
      }

      let msg = `Tu pedido ha entrado en la cola. Posición: ${queuePosition || 'Desconocida'}.`;
      if (estimatedTime) {
        msg += ` Tiempo estimado de espera: ${estimatedTime}.`;
      }

      await updateOrderState(matchedOrderId, {
        status: 'queued',
        message: msg,
        queuePosition
      });
    }
  }

  public getStatus(): { connected: boolean; userTag: string | null; channelId: string | null } {
    return {
      connected: this.isConnected,
      userTag: this.client.user?.tag ?? null,
      channelId: this.targetChannelId,
    };
  }

  public disconnect() {
    this.savedToken = null; // Prevents auto-reconnect
    if (this.isConnected) {
      this.client.destroy();
      this.isConnected = false;
      console.log('[DiscordBridge] Disconnected.');
    }
  }
}

export const discordBridge = new DiscordBridgeService();
