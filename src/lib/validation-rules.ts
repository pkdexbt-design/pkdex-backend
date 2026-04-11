// Validation constants
export const IV_MIN = 0
export const IV_MAX = 31
export const EV_MIN = 0
export const EV_MAX = 252
export const EV_TOTAL_MAX = 510

// Valid Pokemon natures
export const VALID_NATURES: readonly string[] = [
  'Hardy', 'Lonely', 'Brave', 'Adamant', 'Naughty',
  'Bold', 'Docile', 'Relaxed', 'Impish', 'Lax',
  'Timid', 'Hasty', 'Serious', 'Jolly', 'Naive',
  'Modest', 'Mild', 'Quiet', 'Bashful', 'Rash',
  'Calm', 'Gentle', 'Sassy', 'Careful', 'Quirky'
]

export type Nature = typeof VALID_NATURES[number]

export const STATS = ['hp', 'attack', 'defense', 'sp_attack', 'sp_defense', 'speed'] as const

export type Stat = typeof STATS[number]

export interface PokemonStats {
  hp: { iv: number; ev: number }
  attack: { iv: number; ev: number }
  defense: { iv: number; ev: number }
  sp_attack: { iv: number; ev: number }
  sp_defense: { iv: number; ev: number }
  speed: { iv: number; ev: number }
}

export type GameVersion = 'scarlet' | 'violet' | 'legends-za'

export interface PokemonData {
  species: string
  level: number
  stats: PokemonStats
  moves: string[]
  ability: string
  nature: string
  isShiny: boolean
  gender?: 'M' | 'F' | 'N'
  form?: string
  gameVersion?: GameVersion
}

export interface ValidationError {
  field: string
  message: string
}

export interface ValidationWarning {
  field: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  meta?: {
    isHA?: boolean
    genderRatio?: number
    possibleAbilities?: string[]
  }
}
