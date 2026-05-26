import {
  PokemonData,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  IV_MIN,
  IV_MAX,
  EV_MIN,
  EV_MAX,
  EV_TOTAL_MAX,
  STATS,
  Stat,
  VALID_NATURES
} from './validation-rules'
import { validateShowdown } from './showdown-validator'
import { games, validate } from './gameDb'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Validates Pokemon stats (IVs and EVs)
 */
export function validateStats(stats: PokemonData['stats']): ValidationError[] {
  const errors: ValidationError[] = []
  let evTotal = 0

  for (const stat of STATS) {
    const { iv, ev } = stats[stat]

    // Validate IVs
    if (iv < IV_MIN || iv > IV_MAX) {
      errors.push({
        field: `stats.${stat}.iv`,
        message: `IV must be between ${IV_MIN} and ${IV_MAX}`
      })
    }

    // Validate EVs
    if (ev < EV_MIN || ev > EV_MAX) {
      errors.push({
        field: `stats.${stat}.ev`,
        message: `EV must be between ${EV_MIN} and ${EV_MAX}`
      })
    }

    evTotal += ev
  }

  // Check total EVs
  if (evTotal > EV_TOTAL_MAX) {
    errors.push({
      field: 'stats',
      message: `Total EVs (${evTotal}) exceed maximum of ${EV_TOTAL_MAX}`
    })
  }

  return errors
}

/**
 * Validates Pokemon level
 */
export function validateLevel(level: number): ValidationError[] {
  const errors: ValidationError[] = []
  
  if (level < 1 || level > 100) {
    errors.push({
      field: 'level',
      message: 'Level must be between 1 and 100'
    })
  }

  return errors
}

/**
 * Validates Pokemon moves (basic validation)
 */
export function validateMoves(moves: string[]): ValidationError[] {
  const errors: ValidationError[] = []

  if (moves.length === 0) {
    errors.push({
      field: 'moves',
      message: 'Pokemon must have at least one move'
    })
  }

  if (moves.length > 4) {
    errors.push({
      field: 'moves',
      message: 'Pokemon cannot have more than 4 moves'
    })
  }

  // Check for duplicate moves
  const uniqueMoves = new Set(moves)
  if (uniqueMoves.size !== moves.length) {
    errors.push({
      field: 'moves',
      message: 'Duplicate moves are not allowed'
    })
  }

  return errors
}

/**
 * Validates Pokemon nature
 */
export function validateNature(nature: string): ValidationError[] {
  const errors: ValidationError[] = []
  
  if (!VALID_NATURES.includes(nature)) {
    errors.push({
      field: 'nature',
      message: `Invalid nature. Must be one of: ${VALID_NATURES.join(', ')}`
    })
  }

  return errors
}

/**
 * Quick sync validation — runs all non-async checks.
 * Returns errors and an empty warnings array (sync path has no warnings).
 */
export function validatePokemon(pokemon: PokemonData): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  // Validate all sync aspects
  errors.push(...validateLevel(pokemon.level))
  errors.push(...validateStats(pokemon.stats))
  errors.push(...validateMoves(pokemon.moves))
  errors.push(...validateNature(pokemon.nature))

  // Basic required fields
  if (!pokemon.species || pokemon.species.trim() === '') {
    errors.push({ field: 'species', message: 'Species is required' })
  }

  if (!pokemon.ability || pokemon.ability.trim() === '') {
    errors.push({ field: 'ability', message: 'Ability is required' })
  }

  if (!pokemon.nature || pokemon.nature.trim() === '') {
    errors.push({ field: 'nature', message: 'Nature is required' })
  }

  return { valid: errors.length === 0, errors, warnings }
}

/**
 * Full async validation — runs sync checks PLUS Showdown Core validation
 * (move learnability, ability legality, gender rate) via PokeAPI.
 *
 * This is the preferred endpoint for order creation.
 */
export async function validatePokemonFull(pokemon: PokemonData): Promise<ValidationResult> {
  const isZA = pokemon.gameVersion === 'legends-za';
  const isSV = pokemon.gameVersion === 'scarlet' || pokemon.gameVersion === 'violet';

  if (isZA || isSV) {
    const gameId = isZA ? 'za' : 'sv';
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // 1. Basic required species
    if (!pokemon.species || pokemon.species.trim() === '') {
      errors.push({ field: 'species', message: 'Species is required' });
      return { valid: false, errors, warnings };
    }

    // 2. Normalize and check if Pokémon is in the game database
    const searchName = pokemon.species.toLowerCase().trim().replace(/\s+/g, '-');
    const match = games[gameId].pokemon.find((p: any) => 
      p.name.toLowerCase() === searchName || 
      p.displayName.toLowerCase().trim().replace(/\s+/g, '-') === searchName ||
      p.displayName.toLowerCase().trim() === pokemon.species.toLowerCase().trim()
    );

    if (!match) {
      errors.push({
        field: 'species',
        message: `El Pokémon "${pokemon.species}" no está disponible en ${isZA ? 'Legends: Z-A' : 'Scarlet / Violet'}.`
      });
      return { valid: false, errors, warnings };
    }

    const speciesId = match.species;
    const formId = match.form;

    // 3. Validate moves length (standard rules: 1-4, no duplicates)
    if (pokemon.moves && pokemon.moves.length > 0) {
      errors.push(...validateMoves(pokemon.moves));
    }

    // 4. Validate stats range
    if (pokemon.stats) {
      errors.push(...validateStats(pokemon.stats));
    }

    // 5. Run local database-driven encounter validation
    const validationResult = validate(gameId, {
      species: speciesId,
      form: formId,
      level: pokemon.level,
      shiny: pokemon.isShiny,
      alpha: pokemon.isAlpha,
      ball: pokemon.pokeball,
      gender: pokemon.gender,
      gameVersion: pokemon.gameVersion,
      teraType: pokemon.teraType
    });

    if (!validationResult.valid) {
      validationResult.errors.forEach((err: any) => {
        errors.push({
          field: 'encounter',
          message: err
        });
      });
    }

    // 6. Gather Showdown core metadata (abilities list, HA status, gender rates) for Scarlet/Violet
    let meta: any = {
      genderRatio: 0.5,
      possibleAbilities: [pokemon.ability || 'None']
    };

    if (isSV && pokemon.ability) {
      try {
        const showdownResult = await validateShowdown({
          species: pokemon.species,
          ability: pokemon.ability,
          moves: pokemon.moves,
          gender: pokemon.gender,
        });
        
        meta = {
          isHA: showdownResult.meta.isHA,
          genderRatio: showdownResult.meta.genderRatio,
          possibleAbilities: showdownResult.meta.possibleAbilities,
        };
      } catch (e) {
        // ignore showdown errors to prevent blocking database validity
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      meta
    };
  }

  // Run sync validation first
  const syncResult = validatePokemon(pokemon);
  const errors = [...syncResult.errors];
  const warnings: ValidationWarning[] = [...syncResult.warnings];

  // Only run Showdown validation if species and ability are present
  if (pokemon.species && pokemon.ability) {
    const showdownResult = await validateShowdown({
      species: pokemon.species,
      ability: pokemon.ability,
      moves: pokemon.moves,
      gender: pokemon.gender,
    });

    errors.push(...showdownResult.errors);
    warnings.push(...showdownResult.warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      meta: {
        isHA: showdownResult.meta.isHA,
        genderRatio: showdownResult.meta.genderRatio,
        possibleAbilities: showdownResult.meta.possibleAbilities,
      },
    };
  }

  return { valid: errors.length === 0, errors, warnings };
}
