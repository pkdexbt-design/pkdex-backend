import { PokemonBuildPayload } from './order-types'

/**
 * Converts a PokemonBuildPayload to a Showdown-format string.
 * This format is understood by PKHeX's AutoLegalityMod (ALM)
 * and will produce a valid, legal .pk9 / .pk1-9 file.
 *
 * Supported ALM extensions beyond base Showdown format:
 *   Ball: Master Ball
 *   Alpha: Yes            (Legends ZA)
 *   Shiny: Yes
 *   Language: spa
 *
 * Example for Legends ZA:
 *   Charmander
 *   Ability: Blaze
 *   Level: 50
 *   Ball: Poké Ball
 *   Jolly Nature
 *   - Ember
 *   - Growl
 *   - Scratch
 *   - Smokescreen
 */

const LEGENDS_ZA_GAME = 'legends-za'

// Ball name mappings (Showdown → ALM-accepted names)
const BALL_NAME_MAP: Record<string, string> = {
  'poke ball':     'Poké Ball',
  'pokeball':      'Poké Ball',
  'poke':          'Poké Ball',
  'great ball':    'Great Ball',
  'ultra ball':    'Ultra Ball',
  'master ball':   'Master Ball',
  'safari ball':   'Safari Ball',
  'net ball':      'Net Ball',
  'dive ball':     'Dive Ball',
  'nest ball':     'Nest Ball',
  'repeat ball':   'Repeat Ball',
  'timer ball':    'Timer Ball',
  'luxury ball':   'Luxury Ball',
  'premier ball':  'Premier Ball',
  'dusk ball':     'Dusk Ball',
  'heal ball':     'Heal Ball',
  'quick ball':    'Quick Ball',
  'cherish ball':  'Cherish Ball',
  'fast ball':     'Fast Ball',
  'level ball':    'Level Ball',
  'lure ball':     'Lure Ball',
  'heavy ball':    'Heavy Ball',
  'love ball':     'Love Ball',
  'friend ball':   'Friend Ball',
  'moon ball':     'Moon Ball',
  'sport ball':    'Sport Ball',
  'park ball':     'Park Ball',
  'dream ball':    'Dream Ball',
  'beast ball':    'Beast Ball',
}

function normalizeBallName(ball: string): string {
  const lower = ball.toLowerCase().trim()
  return BALL_NAME_MAP[lower] ?? capitalize(ball)
}

export function buildShowdownText(pokemon: PokemonBuildPayload, gameVersion?: string): string {
  const lines: string[] = []
  const isLegendsZA = gameVersion === LEGENDS_ZA_GAME

  // ── Header: Species @ HeldItem ───────────────────────────────────────
  const hasHeldItem = pokemon.heldItem &&
    pokemon.heldItem.trim() !== '' &&
    pokemon.heldItem.toLowerCase() !== 'none'
  const speciesLine = hasHeldItem
    ? `${formatSpeciesName(pokemon.species)} @ ${capitalize(pokemon.heldItem!)}`
    : formatSpeciesName(pokemon.species)
  lines.push(speciesLine)

  // ── Ability ──────────────────────────────────────────────────────────
  if (pokemon.ability) {
    lines.push(`Ability: ${capitalize(pokemon.ability)}`)
  }

  // ── Level ────────────────────────────────────────────────────────────
  lines.push(`Level: ${pokemon.level}`)

  // ── Shiny ────────────────────────────────────────────────────────────
  if (pokemon.shiny) {
    lines.push('Shiny: Yes')
  }

  // ── Alpha (Legends ZA only) ───────────────────────────────────────────
  if (pokemon.alpha && isLegendsZA) {
    lines.push('Alpha: Yes')
  }

  // ── Gender ───────────────────────────────────────────────────────────
  if (pokemon.gender === 'M') lines.push('Gender: Male')
  else if (pokemon.gender === 'F') lines.push('Gender: Female')

  // ── Language ─────────────────────────────────────────────────────────
  // Sets the Pokémon's language tag. ALM uses this for name/form localization.
  // Default: Spanish (most common for this service).
  const language = (pokemon as any).language ?? 'Spanish'
  lines.push(`Language: ${language}`)

  // ── Tera Type (not applicable for Legends ZA) ────────────────────────
  if (pokemon.teraType && !isLegendsZA) {
    lines.push(`Tera Type: ${capitalize(pokemon.teraType)}`)
  }

  // ── Ball ─────────────────────────────────────────────────────────────
  // ALM supports "Ball: <name>" to set which Poké Ball is used.
  // For Legends ZA we SKIP this field entirely:
  //   - The special char 'é' in "Poké Ball" can cause encoding issues on Windows SysBot
  //   - ALM auto-selects the most legal ball for ZA encounters
  // For Scarlet/Violet we include the ball normally.
  if (!isLegendsZA && pokemon.pokeball) {
    lines.push(`Ball: ${normalizeBallName(pokemon.pokeball)}`)
  }

  // ── EVs ───────────────────────────────────────────────────────────────────
  // For Legends ZA: SKIP EVs entirely. ZA uses Effort Levels (EL), not EVs.
  // Sending standard EV lines (e.g. "252 Atk / 252 Spe") causes ALM to crash
  // with "Index was outside the bounds of the array". ALM auto-assigns ELs.
  // For Scarlet/Violet: include EVs normally.
  if (!isLegendsZA) {
    const evParts = buildStatLine(pokemon.evs)
    if (evParts) lines.push(`EVs: ${evParts}`)
  }

  // ── Nature ───────────────────────────────────────────────────────────
  if (pokemon.nature) {
    lines.push(`${capitalize(pokemon.nature)} Nature`)
  }

  // ── IVs (only show non-31 values) ──────────────────────────────────
  const ivParts = buildStatLine(pokemon.ivs, 31)
  if (ivParts) lines.push(`IVs: ${ivParts}`)

  // ── Moves ────────────────────────────────────────────────────────────
  // For Legends ZA: DO NOT send moves. ALM auto-assigns the legal learnset for ZA.
  // Moves from PokeAPI reflect the SV learnset — many don't exist in ZA and ALM rejects them.
  // For Scarlet/Violet: send moves as provided by the user.
  if (!isLegendsZA) {
    const validMoves = pokemon.moves.filter(Boolean)
    for (const move of validMoves) {
      lines.push(`- ${capitalize(move)}`)
    }
  }

  return lines.join('\n')
}


/**
 * Converts an entire team payload to a combined Showdown string (multi-set).
 */
export function teamToShowdownText(team: PokemonBuildPayload[], gameVersion?: string): string {
  return team.map((p) => buildShowdownText(p, gameVersion)).join('\n\n')
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function capitalize(str: string): string {
  if (!str) return str
  // Convert "light-ball" → "Light Ball", "volt-tackle" → "Volt Tackle"
  return str
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ')
}

/**
 * Formats a Pokémon species slug for the Showdown text format.
 * Regional forms must use a hyphen before their suffix, NOT a space:
 *   meowth-galar   → Meowth-Galar   ✅  (SysBot parses correctly)
 *   meowth-galar   → Meowth Galar   ❌  (SysBot: "Species could not be identified")
 * All other hyphens (e.g. multi-word names) become spaces as usual.
 */
const REGIONAL_SUFFIXES = ['-galar', '-alola', '-hisui', '-paldea']

/**
 * Hard overrides for species with special characters in their Showdown name.
 * Keys are PokeAPI slugs (lowercase, hyphenated).
 */
const SPECIES_NAME_OVERRIDES: Record<string, string> = {
  // Mr. Mime family
  'mr-mime':         'Mr. Mime',
  'mr-mime-galar':   'Mr. Mime-Galar',
  'mr-rime':         'Mr. Rime',
  'mime-jr':         'Mime Jr.',
  // Farfetch'd family  
  'farfetchd':       "Farfetch'd",
  'farfetchd-galar': "Farfetch'd-Galar",
  'sirfetchd':       "Sirfetch'd",
  // Nidoran
  'nidoran-f':       'Nidoran-F',
  'nidoran-m':       'Nidoran-M',
  // Hyphen that is NOT a regional suffix (must stay as hyphen)
  'ho-oh':           'Ho-Oh',
  'porygon-z':       'Porygon-Z',
  'jangmo-o':        'Jangmo-o',
  'hakamo-o':        'Hakamo-o',
  'kommo-o':         'Kommo-o',
  // Type: Null
  'type-null':       'Type: Null',
  // Flabébé
  'flabebe':         'Flabébé',
  // Zygarde forms (Frontend sends the PokeAPI slug which is 'zygarde-10', no % sign)
  'zygarde-10':      'Zygarde-10%',    // PokeAPI slug → Showdown name
  'zygarde-10%':     'Zygarde-10%',
  'zygarde-10%-c':   'Zygarde-10%',
  'zygarde-50':      'Zygarde',
  'zygarde-50-c':    'Zygarde',
  'zygarde-50%':     'Zygarde',
  'zygarde-complete':'Zygarde-Complete',
}

function formatSpeciesName(slug: string): string {
  if (!slug) return slug
  // Normalize string for lookup: remove typographic apostrophes, lowercase
  const lower = slug.toLowerCase().replace('’', "'")

  // 1. Hard override takes absolute priority (Mr. Mime, Farfetch'd, Ho-Oh, etc.)
  if (SPECIES_NAME_OVERRIDES[lower]) {
    return SPECIES_NAME_OVERRIDES[lower]
  }

  // Handle specific case for zygarde that might have uppercase 'C' in slug
  if (lower === 'zygarde-10%-c' || lower === 'zygarde-10-c') return 'Zygarde-10%'
  if (lower === 'zygarde-50%-c' || lower === 'zygarde-50-c' || lower === 'zygarde-50') return 'Zygarde'


  // 2. Regional suffix: preserve hyphen before suffix (-galar, -alola, -hisui, -paldea)
  for (const suffix of REGIONAL_SUFFIXES) {
    if (lower.endsWith(suffix)) {
      const basePart = slug.slice(0, slug.length - suffix.length)
      const formattedBase = basePart
        .split('-')
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(' ')
      // Capitalize suffix: "-galar" → "-Galar"
      const formattedSuffix = suffix.charAt(1).toUpperCase() + suffix.slice(2)
      return `${formattedBase}-${formattedSuffix}`
    }
  }

  // 3. Standard capitalize (hyphens become spaces)
  return capitalize(slug)
}


interface Stats {
  hp: number
  attack: number
  defense: number
  spAttack: number
  spDefense: number
  speed: number
}

/**
 * Builds a Showdown stat line string.
 * @param exclude - Only include stats that DON'T equal this value (for IVs, exclude 31)
 */
function buildStatLine(stats: Stats, exclude?: number): string {
  const mapping: [string, number][] = [
    ['HP', stats.hp],
    ['Atk', stats.attack],
    ['Def', stats.defense],
    ['SpA', stats.spAttack],
    ['SpD', stats.spDefense],
    ['Spe', stats.speed],
  ]

  const parts = mapping
    .filter(([, val]) => {
      if (exclude !== undefined) return val !== exclude
      return val > 0
    })
    .map(([label, val]) => `${val} ${label}`)

  return parts.join(' / ')
}
