import express, { Request, Response } from 'express'
import { validatePokemonFull } from '../lib/pokemon-validator'
import { PokemonData } from '../lib/validation-rules'

const router = express.Router()

/**
 * @swagger
 * /api/validate:
 *   post:
 *     summary: Validar datos de un Pokémon
 *     description: Valida que los datos de un Pokémon sean legales según las reglas del juego (IVs, EVs, movimientos, naturaleza, etc.)
 *     tags:
 *       - Validation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PokemonData'
 *           example:
 *             species: "Pikachu"
 *             level: 50
 *             stats:
 *               hp: { iv: 31, ev: 252 }
 *               attack: { iv: 31, ev: 0 }
 *               defense: { iv: 31, ev: 4 }
 *               sp_attack: { iv: 31, ev: 252 }
 *               sp_defense: { iv: 31, ev: 0 }
 *               speed: { iv: 31, ev: 0 }
 *             moves: ["Thunder", "Quick Attack", "Iron Tail", "Thunderbolt"]
 *             ability: "Static"
 *             nature: "Timid"
 *             isShiny: false
 *     responses:
 *       200:
 *         description: Resultado de la validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationResult'
 *             examples:
 *               valid:
 *                 summary: Pokémon válido
 *                 value:
 *                   valid: true
 *                   errors: []
 *               invalid:
 *                 summary: Pokémon inválido
 *                 value:
 *                   valid: false
 *                   errors:
 *                     - field: "stats.hp.iv"
 *                       message: "IV must be between 0 and 31"
 *                     - field: "nature"
 *                       message: "Invalid nature. Must be one of: Hardy, Lonely, ..."
 *       400:
 *         description: Datos faltantes en la petición
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: "Missing Pokemon data in request body"
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: "Internal server error during validation"
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const pokemonData: PokemonData = req.body

    if (!pokemonData) {
      return res.status(400).json({
        error: 'Missing Pokemon data in request body'
      })
    }

    const result = await validatePokemonFull(pokemonData)

    return res.status(200).json(result)
  } catch (error) {
    console.error('Validation error:', error)
    return res.status(500).json({
      error: 'Internal server error during validation'
    })
  }
})

export default router
