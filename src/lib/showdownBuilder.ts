import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

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
  dexId?: number
  form?: number
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
  moves: string[]
  ivs: StatValues
  evs: StatValues
  game?: string
  encounter?: Record<string, any>
  isAlphaEncounter?: boolean
  homeProfileId?: string | null
}

const LEGENDS_ZA_GAME = 'legends-za'
const ZA_GAME_ID = 'za'

// ─── Showdown Aliases ─────────────────────────────────────────────────────────
// Load the alias map once (at module init) to convert visual names → Showdown names
let _aliasMap: Record<string, string> | null = null;

function loadAliasMap(): Record<string, string> {
  if (_aliasMap) return _aliasMap;
  try {
    const aliasPath = join(__dirname, 'data', 'showdown_aliases.json');
    if (existsSync(aliasPath)) {
      _aliasMap = JSON.parse(readFileSync(aliasPath, 'utf8'));
    } else {
      _aliasMap = {};
    }
  } catch {
    _aliasMap = {};
  }
  return _aliasMap!;
}

/**
 * Convert a visual display name (Spanish or English) to the Showdown-compatible
 * species name that SysBot / Auto-Legality can parse.
 * Falls back to formatSpeciesName() for anything not in the alias map.
 */
export function getShowdownSpeciesName(order: PokemonBuildPayload): string {
  const aliases = loadAliasMap();
  
  // 1. Try species ID + form mapping first (extremely accurate)
  const dexId = order.dexId ?? (typeof order.species === 'number' ? order.species : (!isNaN(Number(order.species)) ? Number(order.species) : undefined));
  const form = order.form ?? 0;

  if (dexId !== undefined) {
    if (dexId === 676) { // Furfrou
      const furfrouForms: Record<number, string> = {
        0: 'Furfrou',
        1: 'Furfrou-Heart',
        2: 'Furfrou-Star',
        3: 'Furfrou-Diamond',
        4: 'Furfrou-Debutante',
        5: 'Furfrou-Matron',
        6: 'Furfrou-Dandy',
        7: 'Furfrou-La-Reine',
        8: 'Furfrou-Kabuki',
        9: 'Furfrou-Pharaoh'
      };
      if (furfrouForms[form] !== undefined) return furfrouForms[form];
    }
    if (dexId === 718) { // Zygarde
      if (form === 1) return 'Zygarde-10%';
      if (form === 2) return 'Zygarde-Complete';
      return 'Zygarde';
    }
    if (dexId === 670) { // Floette
      const floetteForms: Record<number, string> = {
        0: 'Floette',
        1: 'Floette-Yellow',
        2: 'Floette-Orange',
        3: 'Floette-Blue',
        4: 'Floette-White',
        5: 'Floette-Eternal'
      };
      if (floetteForms[form] !== undefined) return floetteForms[form];
    }
    if (dexId === 671) { // Florges
      const florgesForms: Record<number, string> = {
        0: 'Florges',
        1: 'Florges-Yellow',
        2: 'Florges-Orange',
        3: 'Florges-Blue',
        4: 'Florges-White'
      };
      if (florgesForms[form] !== undefined) return florgesForms[form];
    }
    if (dexId === 710) { // Pumpkaboo
      const pumpkabooForms: Record<number, string> = {
        0: 'Pumpkaboo',
        1: 'Pumpkaboo-Small',
        2: 'Pumpkaboo-Large',
        3: 'Pumpkaboo-Super'
      };
      if (pumpkabooForms[form] !== undefined) return pumpkabooForms[form];
    }
    if (dexId === 711) { // Gourgeist
      const gourgeistForms: Record<number, string> = {
        0: 'Gourgeist',
        1: 'Gourgeist-Small',
        2: 'Gourgeist-Large',
        3: 'Gourgeist-Super'
      };
      if (gourgeistForms[form] !== undefined) return gourgeistForms[form];
    }
  }

  // 2. Try various name keys against our alias map
  const nameKeys = [
    (order as any).displayNameEn,
    (order as any).displayName,
    order.species,
    (order as any).pokemonName,
    (order as any).nameEn,
    (order as any).name,
    (order as any).speciesName
  ];

  for (const nameKey of nameKeys) {
    if (nameKey) {
      const key = String(nameKey).trim().toLowerCase();
      if (aliases[key]) return aliases[key];
    }
  }

  // 3. Fallback to formatSpeciesName()
  const raw = String(order.species || '').trim();
  return formatSpeciesName(raw);
}

// ─── Valid natures ────────────────────────────────────────────────────────────
const NATURES = [
  'Hardy','Lonely','Brave','Adamant','Naughty',
  'Bold','Docile','Relaxed','Impish','Lax',
  'Timid','Hasty','Serious','Jolly','Naive',
  'Modest','Mild','Quiet','Bashful','Rash',
  'Calm','Gentle','Sassy','Careful','Quirky',
];

/**
 * If nature is empty or "Random", picks a valid random nature.
 * This prevents sending "Random Nature" to SysBot which causes parse errors.
 */
function normalizeNature(nature: string | undefined): string {
  if (!nature || String(nature).toLowerCase() === 'random') {
    return NATURES[Math.floor(Math.random() * NATURES.length)];
  }
  return nature;
}

/**
 * If gender is empty or "Random", returns null so no Gender line is sent.
 * Auto-Legality / PKHeX will pick a legal gender for the species automatically.
 */
function normalizeGender(gender: string | undefined): string | null {
  if (!gender || String(gender).toLowerCase() === 'random') return null;
  if (gender === 'Male' || gender === 'Macho' || gender === 'M') return 'Male';
  if (gender === 'Female' || gender === 'Hembra' || gender === 'F') return 'Female';
  return null;
}

/**
 * Alpha: Only included in the Showdown set when:
 *   1. The game is Legends: Z-A
 *   2. The encounter itself is marked as Alpha (payload.alpha = Boolean(selectedEncounter.isAlpha))
 * Never sent for Scarlet/Violet.
 */
function shouldIncludeAlpha(pokemon: PokemonBuildPayload, isLegendsZA: boolean): boolean {
  if (!isLegendsZA) return false;
  // pokemon.alpha is set from Boolean(selectedEncounter.isAlpha) in the frontend payload,
  // so it already correctly encodes "this encounter is an alpha encounter"
  return Boolean(pokemon.alpha);
}

// ─── Ball name mappings (Showdown → ALM-accepted names) ───────────────────────
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
  const isLegendsZA = gameVersion === LEGENDS_ZA_GAME || gameVersion === ZA_GAME_ID

  // ── Header: Species @ HeldItem ───────────────────────────────────────────────
  const showdownSpecies = getShowdownSpeciesName(pokemon);
  const hasHeldItem = pokemon.heldItem &&
    pokemon.heldItem.trim() !== '' &&
    pokemon.heldItem.toLowerCase() !== 'none' &&
    pokemon.heldItem.toLowerCase() !== 'sin objeto'
  const speciesLine = hasHeldItem
    ? `${showdownSpecies} @ ${capitalize(pokemon.heldItem!)}`
    : showdownSpecies
  lines.push(speciesLine)

  // ── Ability ──────────────────────────────────────────────────────────────────
  if (pokemon.ability && String(pokemon.ability).toLowerCase() !== 'random') {
    lines.push(`Ability: ${capitalize(pokemon.ability)}`)
  }

  // ── Level ────────────────────────────────────────────────────────────────────
  lines.push(`Level: ${pokemon.level}`)

  // ── Shiny ────────────────────────────────────────────────────────────────────
  if (pokemon.shiny) {
    lines.push('Shiny: Yes')
  }

  // ── Alpha (Legends ZA ONLY, and only if encounter is alpha) ──────────────────
  if (shouldIncludeAlpha(pokemon, isLegendsZA)) {
    lines.push('Alpha: Yes')
  }

  // ── Gender (skip if Random — let ALM choose) ──────────────────────────────────
  const gender = normalizeGender(pokemon.gender)
  if (gender) lines.push(`Gender: ${gender}`)

  // ── Language ─────────────────────────────────────────────────────────────────
  const eventLanguage = (pokemon as any).eventLanguage
  const language = eventLanguage ?? ((pokemon as any).language ?? 'Spanish')
  const strictEventSpecies = [
    'genesect', 'hoopa', 'volcanion', 'diancie', 'zarude', 'zeraora',
    'marshadow', 'meloetta', 'victini', 'groudon', 'kyogre', 'rayquaza',
  ]
  const isStrictEvent = strictEventSpecies.includes(String(pokemon.species).toLowerCase())
  if (!isStrictEvent || eventLanguage) {
    lines.push(`Language: ${language}`)
  }

  // ── Event OT / TID (for Cherish Ball event Pokémon) ──────────────────────────
  const eventOT  = (pokemon as any).eventOT
  const eventTID = (pokemon as any).eventTID
  if (eventOT)  lines.push(`OT: ${eventOT}`)
  if (eventTID) lines.push(`TID: ${eventTID}`)

  // ── Tera Type (not applicable for Legends ZA) ────────────────────────────────
  if (pokemon.teraType && !isLegendsZA) {
    lines.push(`Tera Type: ${capitalize(pokemon.teraType)}`)
  }

  // ── Ball ─────────────────────────────────────────────────────────────────────
  if (!isLegendsZA && pokemon.pokeball) {
    lines.push(`Ball: ${normalizeBallName(pokemon.pokeball)}`)
  }

  // ── EVs ───────────────────────────────────────────────────────────────────────
  if (!isLegendsZA && pokemon.evs) {
    const evParts = buildStatLine(pokemon.evs)
    if (evParts) lines.push(`EVs: ${evParts}`)
  }

  // ── Nature (always normalized — never "Random Nature") ────────────────────────
  lines.push(`${normalizeNature(pokemon.nature)} Nature`)

  // ── IVs (only show non-31 values) ────────────────────────────────────────────
  if (pokemon.ivs) {
    const ivParts = buildStatLine(pokemon.ivs, 31)
    if (ivParts) lines.push(`IVs: ${ivParts}`)
  }

  // ── Moves ────────────────────────────────────────────────────────────────────
  if (!isLegendsZA && Array.isArray(pokemon.moves)) {
    const validMoves = pokemon.moves.filter(Boolean)
    for (const move of validMoves) {
      lines.push(`- ${capitalize(move)}`)
    }
  }

  return lines.join('\n')
}

export function teamToShowdownText(team: PokemonBuildPayload[], gameVersion?: string): string {
  return team.map((p) => buildShowdownText(p, gameVersion)).join('\n\n')
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function capitalize(str: string): string {
  if (!str) return str
  return str
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ')
}

const REGIONAL_SUFFIXES = ['-galar', '-alola', '-hisui', '-paldea']

const SPECIES_NAME_OVERRIDES: Record<string, string> = {
  'mr-mime':         'Mr. Mime',
  'mr-mime-galar':   'Mr. Mime-Galar',
  'mr-rime':         'Mr. Rime',
  'mime-jr':         'Mime Jr.',
  'farfetchd':       "Farfetch'd",
  'farfetchd-galar': "Farfetch'd-Galar",
  'sirfetchd':       "Sirfetch'd",
  'nidoran-f':       'Nidoran-F',
  'nidoran-m':       'Nidoran-M',
  'ho-oh':           'Ho-Oh',
  'porygon-z':       'Porygon-Z',
  'jangmo-o':        'Jangmo-o',
  'hakamo-o':        'Hakamo-o',
  'kommo-o':         'Kommo-o',
  'type-null':       'Type: Null',
  'flabebe':         'Flabébé',
  'zygarde-10':      'Zygarde-10%',
  'zygarde-10%':     'Zygarde-10%',
  'zygarde-10%-c':   'Zygarde-10%',
  'zygarde-50':      'Zygarde',
  'zygarde-50-c':    'Zygarde',
  'zygarde-50%':     'Zygarde',
  'zygarde-complete':'Zygarde-Complete',
}

function formatSpeciesName(slug: string): string {
  if (!slug) return slug
  const lower = slug.toLowerCase().replace('\u2019', "'")

  if (SPECIES_NAME_OVERRIDES[lower]) {
    return SPECIES_NAME_OVERRIDES[lower]
  }

  if (lower === 'zygarde-10%-c' || lower === 'zygarde-10-c') return 'Zygarde-10%'
  if (lower === 'zygarde-50%-c' || lower === 'zygarde-50-c' || lower === 'zygarde-50') return 'Zygarde'

  for (const suffix of REGIONAL_SUFFIXES) {
    if (lower.endsWith(suffix)) {
      const basePart = slug.slice(0, slug.length - suffix.length)
      const formattedBase = basePart
        .split('-')
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(' ')
      const formattedSuffix = suffix.charAt(1).toUpperCase() + suffix.slice(2)
      return `${formattedBase}-${formattedSuffix}`
    }
  }

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
