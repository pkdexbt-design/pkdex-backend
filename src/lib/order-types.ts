/**
 * Shared types for order creation between frontend and backend.
 * Frontend serializes PokemonBuild → PokemonBuildPayload before sending.
 */

export interface StatValues {
  hp: number
  attack: number
  defense: number
  spAttack: number
  spDefense: number
  speed: number
}

export interface PokemonBuildPayload {
  species: string
  level: number
  nature: string
  ability: string
  shiny: boolean
  alpha: boolean
  gender: string
  heldItem: string
  teraType: string
  pokeball: string
  origin: string
  moves: string[]   // Move names (filtered nulls)
  ivs: StatValues
  evs: StatValues
}

export interface CreateOrderRequest {
  team: PokemonBuildPayload[]
  tradeCode: string
  gameVersion: 'scarlet' | 'violet' | 'legends-za'
}

export interface CreateOrderResponse {
  orderId: string
  tradeCode: string
  status: 'pending'
  createdAt: string
}

export type OrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled' | 'failed'
