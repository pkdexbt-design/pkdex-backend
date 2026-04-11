import { describe, it, expect, beforeEach } from 'vitest'
import { validateShowdown, clearShowdownCache } from '../showdown-validator'

// NOTE: These tests make real calls to the public PokeAPI.
// They require an internet connection and may take a few seconds.
// Use vitest's --testTimeout flag if tests are slow.

describe('Showdown Validator — Ability Validation', () => {
  beforeEach(() => {
    clearShowdownCache()
  })

  it('should pass with a valid slot-1 ability (Pikachu + Static)', async () => {
    const result = await validateShowdown({
      species: 'pikachu',
      ability: 'static',
      moves: ['thunder-shock'],
      gender: 'M',
    })

    expect(result.errors.filter((e) => e.field === 'ability')).toHaveLength(0)
    expect(result.meta.possibleAbilities).toContain('static')
  }, 15000)

  it('should pass with a valid slot-2 ability (Pikachu + Lightning-Rod)', async () => {
    const result = await validateShowdown({
      species: 'pikachu',
      ability: 'lightning-rod',
      moves: ['thunder-shock'],
    })

    expect(result.errors.filter((e) => e.field === 'ability')).toHaveLength(0)
  }, 15000)

  it('should error on a completely invalid ability (Pikachu + Levitate)', async () => {
    const result = await validateShowdown({
      species: 'pikachu',
      ability: 'levitate',
      moves: ['thunder-shock'],
    })

    expect(result.errors.some((e) => e.field === 'ability')).toBe(true)
    expect(result.errors[0].message).toContain('levitate')
  }, 15000)

  it('should warn when using a Hidden Ability', async () => {
    // Garchomp: slot 1 = sand-veil, slot 2 (HA) = rough-skin
    const result = await validateShowdown({
      species: 'garchomp',
      ability: 'rough-skin',
      moves: ['dragon-claw'],
    })

    // Should NOT have an ability error (HA is valid, just warned)
    expect(result.errors.filter((e) => e.field === 'ability')).toHaveLength(0)
    // Should have a warning about HA
    expect(result.warnings.some((w) => w.field === 'ability')).toBe(true)
    expect(result.meta.isHA).toBe(true)
  }, 15000)
})

describe('Showdown Validator — Move Learnability', () => {
  beforeEach(() => {
    clearShowdownCache()
  })

  it('should pass when moves are learnable by the species', async () => {
    const result = await validateShowdown({
      species: 'charizard',
      ability: 'blaze',
      moves: ['flamethrower', 'fly'],
    })

    const moveErrors = result.errors.filter((e) => e.field === 'moves')
    expect(moveErrors).toHaveLength(0)
  }, 15000)

  it('should error on a move that the species cannot learn', async () => {
    const result = await validateShowdown({
      species: 'magikarp',
      ability: 'swift-swim',
      moves: ['flamethrower'],  // Magikarp cannot learn Flamethrower
    })

    expect(result.errors.some((e) => e.field === 'moves')).toBe(true)
    expect(result.errors[0].message).toContain('flamethrower')
  }, 15000)

  it('should use cached data on second validation of the same species', async () => {
    // First call — populates cache
    await validateShowdown({ species: 'pikachu', ability: 'static', moves: ['thunder-shock'] })

    // Second call — should use cache (still correct)
    const result = await validateShowdown({ species: 'pikachu', ability: 'static', moves: ['thunder-shock'] })
    expect(result.errors).toHaveLength(0)
  }, 20000)
})

describe('Showdown Validator — Gender Validation', () => {
  beforeEach(() => {
    clearShowdownCache()
  })

  it('should warn when a genderless Pokémon is given a gender (Metagross)', async () => {
    const result = await validateShowdown({
      species: 'metagross',
      ability: 'clear-body',
      moves: ['meteor-mash'],
      gender: 'M',
    })

    expect(result.warnings.some((w) => w.field === 'gender')).toBe(true)
    expect(result.meta.genderRatio).toBe(-1)
  }, 15000)

  it('should not warn when genderless Pokémon has no gender (Metagross)', async () => {
    const result = await validateShowdown({
      species: 'metagross',
      ability: 'clear-body',
      moves: ['meteor-mash'],
      gender: 'N',
    })

    const genderWarnings = result.warnings.filter((w) => w.field === 'gender')
    expect(genderWarnings).toHaveLength(0)
  }, 15000)

  it('should warn when a male-only Pokémon is given female gender (Tauros)', async () => {
    const result = await validateShowdown({
      species: 'tauros',
      ability: 'intimidate',
      moves: ['body-slam'],
      gender: 'F',
    })

    expect(result.warnings.some((w) => w.field === 'gender')).toBe(true)
  }, 15000)
})

describe('Showdown Validator — Network Failure Graceful Fallback', () => {
  it('should return a warning (not crash) for an unknown species slug', async () => {
    clearShowdownCache()
    const result = await validateShowdown({
      species: 'notarealfakemon999',
      ability: 'overgrow',
      moves: ['tackle'],
    })

    // Should return gracefully with a warning about inability to fetch
    expect(result.errors).toHaveLength(0)
    expect(result.warnings.some((w) => w.field === 'general')).toBe(true)
  }, 10000)
})
