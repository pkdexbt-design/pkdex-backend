import { Socket } from 'net'
import { v4 as uuidv4 } from 'uuid'
import { BotStatus } from './types'

export class BotSession {
  public readonly id: string
  public status: BotStatus = 'IDLE'
  public gameVersion: string = 'unknown'
  public tradeCode: string = '00000000'  // Fixed trade code configured in SysBot.NET Hub
  public connectedAt: Date
  public lastSeen: number
  
  private socket: Socket
  private dataBuffer: string = ''
  private heartbeatInterval?: NodeJS.Timeout

  // Custom events
  public onDisconnect?: (id: string) => void
  public onMessage?: (id: string, message: string) => void
  public onAuth?: (id: string, gameVersion: string) => void

  constructor(socket: Socket) {
    this.id = uuidv4()
    this.socket = socket
    this.connectedAt = new Date()
    this.lastSeen = Date.now()

    this.setupListeners()
    this.startHeartbeat()
  }

  private startHeartbeat() {
    // Check every 30 seconds if the bot hasn't sent data in over 2 minutes (120,000 ms)
    this.heartbeatInterval = setInterval(() => {
      if (Date.now() - this.lastSeen > 120_000) {
        console.warn(`[BotSession ${this.id}] Ping timeout exceeded. Forcing disconnect...`)
        this.status = 'DISCONNECTED'
        this.socket.destroy() // Force close
        if (this.onDisconnect) this.onDisconnect(this.id)
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval)
      }
    }, 30_000)
  }

  private setupListeners() {
    this.socket.setEncoding('utf8')

    this.socket.on('data', (data: Buffer | string) => {
      this.lastSeen = Date.now()
      this.dataBuffer += data.toString()
      this.processBuffer()
    })

    this.socket.on('close', () => {
      this.status = 'DISCONNECTED'
      if (this.heartbeatInterval) clearInterval(this.heartbeatInterval)
      if (this.onDisconnect) this.onDisconnect(this.id)
    })

    this.socket.on('error', (err) => {
      console.error(`[BotSession ${this.id}] Socket error:`, err)
      // Usually followed by a close event
    })
  }

  /**
   * Reads line by line from the incoming stream.
   * SysBots usually communicate with newline-terminated strings.
   */
  private processBuffer() {
    let newlineIndex: number
    while ((newlineIndex = this.dataBuffer.indexOf('\n')) !== -1) {
      const line = this.dataBuffer.substring(0, newlineIndex).trim()
      this.dataBuffer = this.dataBuffer.substring(newlineIndex + 1)
      
      if (line.length > 0) {
        this.handleLine(line)
      }
    }
  }

  /**
   * Basic protocol router.
   */
  private handleLine(line: string) {
    // Heartbeat from BotConnector — just update lastSeen silently
    if (line === 'PING') {
      this.lastSeen = Date.now()
      return
    }

    // Handshake: "HELLO scarlet" or "HELLO scarlet 94320374"
    if (line.startsWith('HELLO ')) {
      const parts = line.split(' ')
      const game = parts[1]
      const code = parts[2]  // Optional trade code from SysBot.NET config
      if (game) {
        this.gameVersion = game
        if (code) this.tradeCode = code
        console.log(`[BotSession ${this.id}] Authenticated as ${game} | Trade Code: ${this.tradeCode}`)
        if (this.onAuth) this.onAuth(this.id, game)
        this.send('OK HANDSHAKE_ACCEPTED')
      }
      return
    }

    if (this.onMessage) {
      this.onMessage(this.id, line)
    }
  }

  /**
   * Send a raw string command to the bot.
   * Ensures it ends with a newline.
   */
  public send(message: string) {
    if (this.status === 'DISCONNECTED' || this.socket.destroyed) {
      console.warn(`[BotSession ${this.id}] Attempted to send to disconnected socket`)
      return
    }
    
    const payload = message.endsWith('\n') ? message : message + '\n'
    this.socket.write(payload)
  }

  /**
   * Check if the bot is still theoretically responsive.
   */
  public isAlive(): boolean {
    return this.status !== 'DISCONNECTED' && !this.socket.destroyed && (Date.now() - this.lastSeen <= 120_000)
  }

  /**
   * Gracefully kick the bot.
   */
  public disconnect() {
    this.socket.end()
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval)
    this.status = 'DISCONNECTED'
  }
}
