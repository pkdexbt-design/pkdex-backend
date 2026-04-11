import { describe, it, expect } from 'vitest'
import {
  validateStats,
  validateLevel,
  validateMoves,
  validateNature,
  validatePokemon
} from '../pokemon-validator'
import { PokemonData } from '../validation-rules'

describe('Pokemon Validator', () => {
  // Helper to create valid Pokemon data
  const createValidPokemon = (): PokemonData => ({
    species: 'Pikachu',
    level: 50,
    stats: {
      hp: { iv: 31, ev: 252 },
      attack: { iv: 31, ev: 0 },
      defense: { iv: 31, ev: 4 },
      sp_attack: { iv: 31, ev: 252 },
      sp_defense: { iv: 31, ev: 0 },
      speed: { iv: 31, ev: 0 }
    },
    moves: ['Thunder', 'Quick Attack', 'Iron Tail', 'Thunderbolt'],
    ability: 'Static',
    nature: 'Timid',
    isShiny: false
  })

  describe('validateStats', () => {
    it('should pass with valid stats', () => {
      const pokemon = createValidPokemon()
      const errors = validateStats(pokemon.stats)
      expect(errors).toHaveLength(0)
    })

    it('should fail when IV is below minimum', () => {
      const pokemon = createValidPokemon()
      pokemon.stats.hp.iv = -1
      const errors = validateStats(pokemon.stats)
      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('stats.hp.iv')
    })

    it('should fail when IV exceeds maximum', () => {
      const pokemon = createValidPokemon()
      pokemon.stats.attack.iv = 32
      const errors = validateStats(pokemon.stats)
      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('stats.attack.iv')
    })

    it('should fail when EV is below minimum', () => {
      const pokemon = createValidPokemon()
      pokemon.stats.defense.ev = -1
      const errors = validateStats(pokemon.stats)
      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('stats.defense.ev')
    })

    it('should fail when EV exceeds maximum per stat', () => {
      const pokemon = createValidPokemon()
      pokemon.stats.speed.ev = 253
      const errors = validateStats(pokemon.stats)
      // Should have 2 errors: one for EV > 252, and one for total EVs > 510
      expect(errors.length).toBeGreaterThanOrEqual(1)
      expect(errors.some(e => e.field === 'stats.speed.ev')).toBe(true)
    })

    it('should fail when total EVs exceed 510', () => {
      const pokemon = createValidPokemon()
      pokemon.stats.hp.ev = 252
      pokemon.stats.attack.ev = 252
      pokemon.stats.defense.ev = 252
      const errors = validateStats(pokemon.stats)
      expect(errors.some(e => e.field === 'stats')).toBe(true)
      expect(errors.some(e => e.message.includes('exceed maximum of 510'))).toBe(true)
    })

    it('should pass with 0 EVs', () => {
      const pokemon = createValidPokemon()
      pokemon.stats.hp.ev = 0
      pokemon.stats.attack.ev = 0
      pokemon.stats.defense.ev = 0
      pokemon.stats.sp_attack.ev = 0
      pokemon.stats.sp_defense.ev = 0
      pokemon.stats.speed.ev = 0
      const errors = validateStats(pokemon.stats)
      expect(errors).toHaveLength(0)
    })

    it('should pass with exactly 510 total EVs', () => {
      const pokemon = createValidPokemon()
      pokemon.stats.hp.ev = 252
      pokemon.stats.attack.ev = 252
      pokemon.stats.defense.ev = 6
      pokemon.stats.sp_attack.ev = 0
      pokemon.stats.sp_defense.ev = 0
      pokemon.stats.speed.ev = 0
      const errors = validateStats(pokemon.stats)
      expect(errors).toHaveLength(0)
    })
  })

  describe('validateLevel', () => {
    it('should pass with valid level', () => {
      const errors = validateLevel(50)
      expect(errors).toHaveLength(0)
    })

    it('should pass with level 1', () => {
      const errors = validateLevel(1)
      expect(errors).toHaveLength(0)
    })

    it('should pass with level 100', () => {
      const errors = validateLevel(100)
      expect(errors).toHaveLength(0)
    })

    it('should fail with level 0', () => {
      const errors = validateLevel(0)
      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('level')
    })

    it('should fail with level 101', () => {
      const errors = validateLevel(101)
      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('level')
    })

    it('should fail with negative level', () => {
      const errors = validateLevel(-5)
      expect(errors).toHaveLength(1)
    })
  })

  describe('validateMoves', () => {
    it('should pass with valid moves', () => {
      const errors = validateMoves(['Thunder', 'Quick Attack', 'Iron Tail'])
      expect(errors).toHaveLength(0)
    })

    it('should pass with 1 move', () => {
      const errors = validateMoves(['Thunder'])
      expect(errors).toHaveLength(0)
    })

    it('should pass with 4 moves', () => {
      const errors = validateMoves(['Thunder', 'Quick Attack', 'Iron Tail', 'Thunderbolt'])
      expect(errors).toHaveLength(0)
    })

    it('should fail with 0 moves', () => {
      const errors = validateMoves([])
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toContain('at least one move')
    })

    it('should fail with more than 4 moves', () => {
      const errors = validateMoves(['Thunder', 'Quick Attack', 'Iron Tail', 'Thunderbolt', 'Electro Ball'])
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toContain('cannot have more than 4 moves')
    })

    it('should fail with duplicate moves', () => {
      const errors = validateMoves(['Thunder', 'Thunder', 'Quick Attack'])
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toContain('Duplicate moves')
    })
  })

  describe('validateNature', () => {
    it('should pass with valid nature', () => {
      const errors = validateNature('Timid')
      expect(errors).toHaveLength(0)
    })

    it('should pass with all valid natures', () => {
      const validNatures = [
        'Hardy', 'Lonely', 'Brave', 'Adamant', 'Naughty',
        'Bold', 'Docile', 'Relaxed', 'Impish', 'Lax',
        'Timid', 'Hasty', 'Serious', 'Jolly', 'Naive',
        'Modest', 'Mild', 'Quiet', 'Bashful', 'Rash',
        'Calm', 'Gentle', 'Sassy', 'Careful', 'Quirky'
      ]
      
      validNatures.forEach(nature => {
        const errors = validateNature(nature)
        expect(errors).toHaveLength(0)
      })
    })

    it('should fail with invalid nature', () => {
      const errors = validateNature('InvalidNature')
      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('nature')
      expect(errors[0].message).toContain('Invalid nature')
    })

    it('should fail with lowercase nature', () => {
      const errors = validateNature('timid')
      expect(errors).toHaveLength(1)
    })
  })

  describe('validatePokemon (integration)', () => {
    it('should pass with completely valid Pokemon', () => {
      const pokemon = createValidPokemon()
      const result = validatePokemon(pokemon)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should fail with missing species', () => {
      const pokemon = createValidPokemon()
      pokemon.species = ''
      const result = validatePokemon(pokemon)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.field === 'species')).toBe(true)
    })

    it('should fail with missing ability', () => {
      const pokemon = createValidPokemon()
      pokemon.ability = ''
      const result = validatePokemon(pokemon)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.field === 'ability')).toBe(true)
    })

    it('should fail with missing nature', () => {
      const pokemon = createValidPokemon()
      pokemon.nature = ''
      const result = validatePokemon(pokemon)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.field === 'nature')).toBe(true)
    })

    it('should accumulate multiple errors', () => {
      const pokemon = createValidPokemon()
      pokemon.level = 101
      pokemon.stats.hp.iv = 32
      pokemon.stats.attack.ev = 300
      pokemon.nature = 'InvalidNature'
      pokemon.moves = []
      
      const result = validatePokemon(pokemon)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(3)
    })

    it('should handle edge case: min valid stats', () => {
      const pokemon = createValidPokemon()
      pokemon.level = 1
      pokemon.stats.hp.iv = 0
      pokemon.stats.attack.iv = 0
      pokemon.stats.defense.iv = 0
      pokemon.stats.sp_attack.iv = 0
      pokemon.stats.sp_defense.iv = 0
      pokemon.stats.speed.iv = 0
      pokemon.stats.hp.ev = 0
      pokemon.stats.attack.ev = 0
      pokemon.stats.defense.ev = 0
      pokemon.stats.sp_attack.ev = 0
      pokemon.stats.sp_defense.ev = 0
      pokemon.stats.speed.ev = 0
      
      const result = validatePokemon(pokemon)
      expect(result.valid).toBe(true)
    })

    it('should handle edge case: max valid stats', () => {
      const pokemon = createValidPokemon()
      pokemon.level = 100
      pokemon.stats.hp.iv = 31
      pokemon.stats.attack.iv = 31
      pokemon.stats.defense.iv = 31
      pokemon.stats.sp_attack.iv = 31
      pokemon.stats.sp_defense.iv = 31
      pokemon.stats.speed.iv = 31
      pokemon.stats.hp.ev = 252
      pokemon.stats.attack.ev = 252
      pokemon.stats.defense.ev = 6
      pokemon.stats.sp_attack.ev = 0
      pokemon.stats.sp_defense.ev = 0
      pokemon.stats.speed.ev = 0
      
      const result = validatePokemon(pokemon)
      expect(result.valid).toBe(true)
    })
  })
})
