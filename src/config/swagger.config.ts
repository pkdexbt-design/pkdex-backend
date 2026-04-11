import swaggerJsdoc from 'swagger-jsdoc'

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Pokémon SysBot Automation API',
      version: '1.0.0',
      description: 'API backend para el sistema de automatización de SysBot de Pokémon. Proporciona validación de datos de Pokémon y endpoints para la gestión de inyecciones.',
      contact: {
        name: 'API Support',
        email: 'support@pokemon-sysbot.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:4000',
        description: 'Servidor de Desarrollo',
      },
      {
        url: 'https://pokemon-sys-bot-backend.vercel.app',
        description: 'Servidor de Producción',
      },
    ],
    components: {
      schemas: {
        PokemonStats: {
          type: 'object',
          properties: {
            hp: {
              type: 'object',
              properties: {
                iv: { type: 'integer', minimum: 0, maximum: 31, description: 'Individual Value (IV)' },
                ev: { type: 'integer', minimum: 0, maximum: 252, description: 'Effort Value (EV)' },
              },
              required: ['iv', 'ev'],
            },
            attack: {
              type: 'object',
              properties: {
                iv: { type: 'integer', minimum: 0, maximum: 31 },
                ev: { type: 'integer', minimum: 0, maximum: 252 },
              },
              required: ['iv', 'ev'],
            },
            defense: {
              type: 'object',
              properties: {
                iv: { type: 'integer', minimum: 0, maximum: 31 },
                ev: { type: 'integer', minimum: 0, maximum: 252 },
              },
              required: ['iv', 'ev'],
            },
            sp_attack: {
              type: 'object',
              properties: {
                iv: { type: 'integer', minimum: 0, maximum: 31 },
                ev: { type: 'integer', minimum: 0, maximum: 252 },
              },
              required: ['iv', 'ev'],
            },
            sp_defense: {
              type: 'object',
              properties: {
                iv: { type: 'integer', minimum: 0, maximum: 31 },
                ev: { type: 'integer', minimum: 0, maximum: 252 },
              },
              required: ['iv', 'ev'],
            },
            speed: {
              type: 'object',
              properties: {
                iv: { type: 'integer', minimum: 0, maximum: 31 },
                ev: { type: 'integer', minimum: 0, maximum: 252 },
              },
              required: ['iv', 'ev'],
            },
          },
          required: ['hp', 'attack', 'defense', 'sp_attack', 'sp_defense', 'speed'],
          description: 'Estadísticas del Pokémon con IVs y EVs. Total de EVs no puede exceder 510.',
        },
        PokemonData: {
          type: 'object',
          properties: {
            species: {
              type: 'string',
              description: 'Nombre de la especie del Pokémon',
              example: 'Pikachu',
            },
            level: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              description: 'Nivel del Pokémon',
              example: 50,
            },
            stats: {
              $ref: '#/components/schemas/PokemonStats',
            },
            moves: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
              maxItems: 4,
              description: 'Lista de movimientos del Pokémon (1-4)',
              example: ['Thunder', 'Quick Attack', 'Iron Tail', 'Thunderbolt'],
            },
            ability: {
              type: 'string',
              description: 'Habilidad del Pokémon',
              example: 'Static',
            },
            nature: {
              type: 'string',
              description: 'Naturaleza del Pokémon',
              enum: [
                'Hardy', 'Lonely', 'Brave', 'Adamant', 'Naughty',
                'Bold', 'Docile', 'Relaxed', 'Impish', 'Lax',
                'Timid', 'Hasty', 'Serious', 'Jolly', 'Naive',
                'Modest', 'Mild', 'Quiet', 'Bashful', 'Rash',
                'Calm', 'Gentle', 'Sassy', 'Careful', 'Quirky',
              ],
              example: 'Timid',
            },
            isShiny: {
              type: 'boolean',
              description: 'Si el Pokémon es shiny',
              example: false,
            },
            gender: {
              type: 'string',
              enum: ['M', 'F', 'N'],
              description: 'Género del Pokémon (Opcional)',
            },
            form: {
              type: 'string',
              description: 'Forma alternativa del Pokémon (Opcional)',
            },
          },
          required: ['species', 'level', 'stats', 'moves', 'ability', 'nature', 'isShiny'],
        },
        ValidationError: {
          type: 'object',
          properties: {
            field: {
              type: 'string',
              description: 'Campo que tiene el error',
              example: 'stats.hp.iv',
            },
            message: {
              type: 'string',
              description: 'Mensaje describiendo el error',
              example: 'IV must be between 0 and 31',
            },
          },
          required: ['field', 'message'],
        },
        ValidationResult: {
          type: 'object',
          properties: {
            valid: {
              type: 'boolean',
              description: 'Si el Pokémon es válido o no',
              example: true,
            },
            errors: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/ValidationError',
              },
              description: 'Lista de errores de validación (vacía si es válido)',
            },
          },
          required: ['valid', 'errors'],
        },
        HealthCheckResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              description: 'Estado del servidor',
              example: 'ok',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Timestamp actual del servidor',
              example: '2026-02-06T14:30:00.000Z',
            },
          },
          required: ['status', 'timestamp'],
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Mensaje de error',
              example: 'Route not found',
            },
          },
          required: ['error'],
        },
      },
    },
  },
  apis: ['./src/server.ts', './src/routes/**/*.ts'],
}

export const swaggerSpec = swaggerJsdoc(options)
