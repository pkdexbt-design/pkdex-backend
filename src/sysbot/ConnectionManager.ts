import { BotSession } from './BotSession'

class ConnectionManager {
  private bots: Map<string, BotSession> = new Map()

  /**
   * Register a new raw socket as a BotSession.
   */
  public addConnection(socket: any) {
    const session = new BotSession(socket)
    this.bots.set(session.id, session)

    console.log(`[ConnectionManager] New connection registered. ID: ${session.id}`)

    session.onDisconnect = (id) => {
      this.bots.delete(id)
      console.log(`[ConnectionManager] Bot disconnected. ID: ${id} | Active total: ${this.bots.size}`)
    }

    session.onAuth = (id, gameVersion) => {
      console.log(`[ConnectionManager] Bot ${id} authenticated for game: ${gameVersion}`)
    }

    session.onMessage = (id, message) => {
      console.log(`[ConnectionManager] <-- [Bot ${id}]: ${message}`)
    }
  }

  /**
   * Number of active bots.
   */
  public get ActiveCount(): number {
    return this.bots.size
  }

  /**
   * Get an idle bot for a specific game version.
   */
  public getAvailableBot(gameVersion: string): BotSession | undefined {
    for (const session of this.bots.values()) {
      // Eagerly clean up dead sessions that haven't been reaped by the interval yet
      if (!session.isAlive()) {
        session.disconnect()
        this.bots.delete(session.id)
        continue
      }

      if (session.gameVersion === gameVersion && session.status === 'IDLE') {
        return session
      }
    }
    return undefined
  }

  /**
   * Lists all connected bots (useful for debugging/admin API).
   */
  public getBotList() {
    return Array.from(this.bots.values()).map(b => ({
      id: b.id,
      gameVersion: b.gameVersion,
      status: b.status,
      connectedAt: b.connectedAt
    }))
  }
}

// Export a singleton instance
export const connectionManager = new ConnectionManager()
