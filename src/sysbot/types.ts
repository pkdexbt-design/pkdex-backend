export type BotStatus = 'IDLE' | 'TRADING' | 'DISCONNECTED'

export interface BotInfo {
  id: string
  gameVersion: string
  connectedAt: Date
  status: BotStatus
}

export interface SysBotCommand {
  action: string
  payload?: any
}
