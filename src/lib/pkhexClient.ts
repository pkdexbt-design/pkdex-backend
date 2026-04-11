import axios from 'axios'
import { PokemonBuildPayload } from './order-types'
import { buildShowdownText } from './showdownBuilder'
import fs from 'fs'

/**
 * PKHeX Sidecar Client
 * Calls the PKHeX HTTP sidecar running on the bot's Windows PC
 * to convert a Showdown-format string into a valid .pk9 binary.
 */

const PKHEX_SIDECAR_URL = process.env.PKHEX_SIDECAR_URL || 'http://100.90.194.72:5001'

export async function convertToPk9(pokemon: PokemonBuildPayload, gameVersion: string = 'scarlet'): Promise<{ buffer: Buffer, filename: string }> {
  const showdownText = buildShowdownText(pokemon)
  
  console.log(`[PKHeX] Converting ${pokemon.species} to pk file (${gameVersion})...`)
  console.log(`[PKHeX] Showdown text:\n${showdownText}`)

  const response = await axios.post(`${PKHEX_SIDECAR_URL}/generate`, showdownText, {
    headers: {
      'Content-Type': 'text/plain',
      'X-Game-Version': gameVersion,  // Tells sidecar to use SAV9ZA vs SAV9SV
    },
    responseType: 'arraybuffer',
    timeout: 30000,
  })

  if (response.status !== 200) {
    throw new Error(`PKHeX sidecar returned error: ${response.status}`)
  }

  const buffer = Buffer.from(response.data)
  // Extract filename from header (sent by C# sidecar), fallback to .pk9
  const sidecarFilename = response.headers['x-filename'] || `${pokemon.species}.pk9`
  
  console.log(`[PKHeX] ✅ ${pokemon.species} converted → ${buffer.length} bytes, file: ${sidecarFilename}`)
  return { buffer, filename: sidecarFilename }
}

/**
 * Saves a .pk9 buffer to a temp path.
 */
export function savePk9ToTemp(buffer: Buffer, filename: string): string {
  const tempPath = `/tmp/${filename}`
  fs.writeFileSync(tempPath, buffer)
  return tempPath
}
