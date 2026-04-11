import { Client } from 'discord.js-selfbot-v13';

class DiscordBridgeService {
  private client: Client;
  private isConnected: boolean = false;
  private targetChannelId: string | null = null;
  private savedToken: string | null = null;

  constructor() {
    this.client = new Client({});

    this.client.on('ready', () => {
      console.log(`[DiscordBridge] ✅ Logged in as: ${this.client.user?.tag}`);
      this.isConnected = true;
    });

    this.client.on('error', (error) => {
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
  }

  private async reconnect() {
    if (this.isConnected) return; // ya se reconectó
    if (!this.savedToken) return;
    try {
      console.log('[DiscordBridge] Reconnecting...');
      // Destroy old client and create a fresh one
      try { this.client.destroy() } catch {}
      this.client = new Client({});
      this.bindClientEvents();
      await this.client.login(this.savedToken);
    } catch (err) {
      console.error('[DiscordBridge] Reconnect failed:', err);
      setTimeout(() => this.reconnect(), 30_000);
    }
  }

  private bindClientEvents() {
    this.client.on('ready', () => {
      console.log(`[DiscordBridge] ✅ Reconnected as: ${this.client.user?.tag}`);
      this.isConnected = true;
    });
    this.client.on('error', () => {
      this.isConnected = false;
      if (this.savedToken) setTimeout(() => this.reconnect(), 10_000);
    });
    this.client.on('shardDisconnect' as any, () => {
      this.isConnected = false;
      if (this.savedToken) setTimeout(() => this.reconnect(), 15_000);
    });
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

  /**
   * Sends the trade command, with an optional wait for connection to be ready.
   * Will wait up to 20 seconds if Discord is still connecting.
   */
  public async sendTradeCommand(showdownText: string, tradeCode: string): Promise<boolean> {
    // Wait up to 20 seconds for the connection to be ready
    if (!this.isConnected) {
      console.warn('[DiscordBridge] Not connected yet, waiting up to 20s...');
      const waited = await this.waitForConnection(20_000);
      if (!waited) {
        console.error('[DiscordBridge] Cannot send command: failed to connect in time.');
        return false;
      }
    }

    if (!this.targetChannelId) {
      console.error('[DiscordBridge] No target channel specified.');
      return false;
    }

    try {
      const channel = await this.client.channels.fetch(this.targetChannelId);
      if (channel && channel.isText()) {
        const formattedCode = tradeCode.replace(/\s/g, ''); // Remove spaces: "1234 5678" -> "12345678"
        const commandText = `!trade ${formattedCode}\n${showdownText}`;
        console.log(`[DiscordBridge] Sending to channel ${this.targetChannelId}:\n${commandText}`);
        await (channel as any).send(commandText);
        console.log('[DiscordBridge] ✅ Command sent!');
        return true;
      } else {
        console.error(`[DiscordBridge] Channel ${this.targetChannelId} not found or is not a text channel.`);
        return false;
      }
    } catch (error) {
      console.error('[DiscordBridge] Error sending command:', error);
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
