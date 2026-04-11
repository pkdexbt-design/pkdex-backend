/**
 * showdown-validator.ts — PSAS-5: Lógica de Validación (Showdown Core)
 *
 * Validates that a Pokémon's moves, ability, and gender are actually legal
 * for the given species, using live PokeAPI data. Results mirror the style
 * used by Pokémon Showdown's legality checker.
 *
 * Data is cached in-memory per species to avoid redundant network requests.
 */

import { ValidationError } from './validation-rules'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShowdownWarning {
  field: string
  message: string
}

export interface ShowdownValidationResult {
  errors: ValidationError[]
  warnings: ShowdownWarning[]
  meta: {
    isHA: boolean                 // true if the selected ability is the Hidden Ability
    genderRatio: number           // PokeAPI gender_rate: -1=genderless, 0=always M, 8=always F
    learnableMoves: string[]      // slugs of all learnable moves for the species
    possibleAbilities: string[]   // slugs of all abilities for the species
  }
}

interface PokeAPISpeciesData {
  gender_rate: number             // -1=genderless, 0=always male, 8=always female
}

interface PokeAPIAbility {
  ability: { name: string }
  is_hidden: boolean
  slot: number
}

interface PokeAPIMove {
  move: { name: string }
}

interface PokeAPIPokemonData {
  abilities: PokeAPIAbility[]
  moves: PokeAPIMove[]
  species: { url: string }
}

// ─── In-memory cache ─────────────────────────────────────────────────────────

const pokemonCache = new Map<string, PokeAPIPokemonData>()
const speciesCache = new Map<string, PokeAPISpeciesData>()

const POKEAPI_BASE = 'https://pokeapi.co/api/v2'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Slugify a name to match PokeAPI naming conventions.
 * E.g. "Garchomp" → "garchomp", "Tapu Koko" → "tapu-koko"
 */
function toSlug(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

async function fetchPokemonData(species: string): Promise<PokeAPIPokemonData | null> {
  const slug = toSlug(species)
  if (pokemonCache.has(slug)) return pokemonCache.get(slug)!

  try {
    const res = await fetch(`${POKEAPI_BASE}/pokemon/${slug}`)
    if (!res.ok) return null
    const data = await res.json() as PokeAPIPokemonData
    pokemonCache.set(slug, data)
    return data
  } catch {
    return null
  }
}

async function fetchSpeciesData(speciesUrl: string): Promise<PokeAPISpeciesData | null> {
  if (speciesCache.has(speciesUrl)) return speciesCache.get(speciesUrl)!

  try {
    const res = await fetch(speciesUrl)
    if (!res.ok) return null
    const data = await res.json() as PokeAPISpeciesData
    speciesCache.set(speciesUrl, data)
    return data
  } catch {
    return null
  }
}

// ─── Validators ───────────────────────────────────────────────────────────────

/**
 * Validates that the selected ability belongs to the species.
 * Returns an error if it doesn't, and flags `isHA` if it is the hidden ability.
 */
function validateAbility(
  selectedAbility: string,
  pokemonAbilities: PokeAPIAbility[]
): { error: ValidationError | null; isHA: boolean; possibleAbilities: string[] } {
  const slug = toSlug(selectedAbility)
  const possibleAbilities = pokemonAbilities.map((a) => a.ability.name)

  const match = pokemonAbilities.find((a) => a.ability.name === slug)

  if (!match) {
    return {
      error: {
        field: 'ability',
        message: `La habilidad "${selectedAbility}" no es válida para esta especie. Habilidades posibles: ${possibleAbilities.join(', ')}`,
      },
      isHA: false,
      possibleAbilities,
    }
  }

  return { error: null, isHA: match.is_hidden, possibleAbilities }
}

/**
 * Validates that each selected move is learnable by the species.
 * Moves that don't appear in PokeAPI's move list are flagged as errors.
 *
 * NOTE: This validates learnability across ALL game versions combined.
 * A stricter per-version check would require game-specific endpoints.
 */
function validateMoves(
  selectedMoves: string[],
  learnableMoves: string[]
): { errors: ValidationError[]; warnings: ShowdownWarning[] } {
  const errors: ValidationError[] = []
  const warnings: ShowdownWarning[] = []
  const learnableSet = new Set(learnableMoves)

  for (const move of selectedMoves) {
    const slug = toSlug(move)
    if (!learnableSet.has(slug)) {
      errors.push({
        field: 'moves',
        message: `El movimiento "${move}" no puede aprenderlo esta especie`,
      })
    }
  }

  return { errors, warnings }
}

/**
 * Validates gender compatibility based on the species' gender_rate.
 * gender_rate: -1 = genderless, 0 = always male, 8 = always female
 */
function validateGender(
  selectedGender: string | undefined,
  genderRate: number
): ShowdownWarning | null {
  if (selectedGender === undefined) return null

  if (genderRate === -1 && selectedGender !== 'N') {
    return {
      field: 'gender',
      message: 'Esta especie es sin género (genderless). El género se ignorará.',
    }
  }

  if (genderRate === 0 && selectedGender === 'F') {
    return {
      field: 'gender',
      message: 'Esta especie solo puede ser Macho.',
    }
  }

  if (genderRate === 8 && selectedGender === 'M') {
    return {
      field: 'gender',
      message: 'Esta especie solo puede ser Hembra.',
    }
  }

  return null
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export interface ShowdownValidationInput {
  species: string
  ability: string
  moves: string[]
  gender?: string  // 'M' | 'F' | 'N'
}

/**
 * Runs full Showdown-style legality validation against live PokeAPI data.
 * Returns errors (blocking), warnings (non-blocking), and metadata.
 */
export async function validateShowdown(
  input: ShowdownValidationInput
): Promise<ShowdownValidationResult> {
  const errors: ValidationError[] = []
  const warnings: ShowdownWarning[] = []
  const meta: ShowdownValidationResult['meta'] = {
    isHA: false,
    genderRatio: 0,
    learnableMoves: [],
    possibleAbilities: [],
  }

  // ── Fetch Pokemon data ────────────────────────────────────────────────────
  const pokemonData = await fetchPokemonData(input.species)

  if (!pokemonData) {
    // If we can't reach PokeAPI, skip Showdown validation gracefully
    warnings.push({
      field: 'general',
      message: `No se pudo verificar la legalidad de "${input.species}" contra la PokeAPI. Verifica la conexión.`,
    })
    return { errors, warnings, meta }
  }

  // ── Ability validation ────────────────────────────────────────────────────
  const abilityResult = validateAbility(input.ability, pokemonData.abilities)
  if (abilityResult.error) errors.push(abilityResult.error)
  meta.isHA = abilityResult.isHA
  meta.possibleAbilities = abilityResult.possibleAbilities

  if (meta.isHA) {
    warnings.push({
      field: 'ability',
      message: 'Estás usando la Habilidad Oculta (HA). Asegúrate de que sea legal en el formato competitivo.',
    })
  }

  // ── Move learnability ─────────────────────────────────────────────────────
  const learnableMoves = pokemonData.moves.map((m) => m.move.name)
  meta.learnableMoves = learnableMoves

  const moveResult = validateMoves(input.moves, learnableMoves)
  errors.push(...moveResult.errors)
  warnings.push(...moveResult.warnings)

  // ── Gender validation ─────────────────────────────────────────────────────
  const speciesData = pokemonData.species?.url
    ? await fetchSpeciesData(pokemonData.species.url)
    : null

  if (speciesData) {
    meta.genderRatio = speciesData.gender_rate
    const genderWarning = validateGender(input.gender, speciesData.gender_rate)
    if (genderWarning) warnings.push(genderWarning)
  }

  return { errors, warnings, meta }
}

/**
 * Clears the in-memory PokeAPI cache. Useful for testing.
 */
export function clearShowdownCache(): void {
  pokemonCache.clear()
  speciesCache.clear()
}
