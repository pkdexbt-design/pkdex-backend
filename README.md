# Pokemon SysBot Backend

Backend API para Pokemon SysBot Automation SaaS.

## Stack Tecnológico

- Node.js + Express
- TypeScript
- Supabase (Auth & Database)
- JWT para autenticación
- Swagger/OpenAPI para documentación

## Instalación

```bash
npm install
```

## Configuración

1. Copia `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```

2. Llena las variables de entorno:
   - `SUPABASE_URL`: Tu URL de Supabase
   - `SUPABASE_ANON_KEY`: Anon key de Supabase
   - `JWT_SECRET`: Secret para firmar tokens
   - `ALLOWED_ORIGINS`: Origins permitidos para CORS (default: http://localhost:3000)

## Desarrollo

```bash
npm run dev
```

El servidor correrá en `http://localhost:4000`

## 📚 Documentación API (Swagger)

La documentación interactiva de la API está disponible a través de Swagger UI:

- **Swagger UI**: [http://localhost:4000/api-docs](http://localhost:4000/api-docs)
- **OpenAPI Spec (JSON)**: [http://localhost:4000/api-docs.json](http://localhost:4000/api-docs.json)

### Producción
- **Swagger UI**: [https://pokemon-sys-bot-backend.vercel.app/api-docs](https://pokemon-sys-bot-backend.vercel.app/api-docs)
- **OpenAPI Spec**: [https://pokemon-sys-bot-backend.vercel.app/api-docs.json](https://pokemon-sys-bot-backend.vercel.app/api-docs.json)

La documentación se actualiza automáticamente a medida que se agregan nuevos endpoints.

## Endpoints Disponibles

### Health Check
```
GET /health
```

### Validación de Pokémon
```
POST /api/validate
Content-Type: application/json

{
  "species": "Pikachu",
  "level": 50,
  "stats": {
    "hp": { "iv": 31, "ev": 252 },
    "attack": { "iv": 31, "ev": 0 },
    "defense": { "iv": 31, "ev": 4 },
    "sp_attack": { "iv": 31, "ev": 252 },
    "sp_defense": { "iv": 31, "ev": 0 },
    "speed": { "iv": 31, "ev": 0 }
  },
  "moves": ["Thunder", "Quick Attack", "Iron Tail", "Thunderbolt"],
  "ability": "Static",
  "nature": "Timid",
  "isShiny": false
}
```

Respuesta:
```json
{
  "valid": true,
  "errors": []
}
```

> Para más detalles y ejemplos, consulta la [documentación de Swagger UI](http://localhost:4000/api-docs).

## Tests

```bash
npm test
```

## Build

```bash
npm run build
npm start
```
