import { Router, Request, Response } from 'express';
import { games, loadEncounters, getOptions, validate, versionAllowed } from '../lib/gameDb';

const zaRouter = Router();

/**
 * GET /api/za/pokemon
 * List of available Pokémon species and forms in Legends: Z-A.
 */
zaRouter.get('/pokemon', (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || '').toLowerCase().trim();
    const method = String(req.query.method || '').toLowerCase().trim();
    let list = games.za.pokemon;

    if (q) {
      list = list.filter((p: any) => 
        String(p.species) === q || 
        [p.displayName, p.displayNameEn, p.name, p.nameEn, p.formLabel, ...(p.searchAliases || [])]
          .some(v => String(v || '').toLowerCase().includes(q))
      );
    }
    if (method) {
      list = list.filter((p: any) => (p.methods || []).some((x: any) => String(x).toLowerCase() === method));
    }

    // Return the list directly as array to preserve backwards compatibility, 
    // or as object if the client prefers it. We'll return it as array since our frontend maps it as an array.
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/za/pokemon/:species/encounters
 * Returns legal encounters for the given species ID.
 * Optional query parameter: form (number)
 */
zaRouter.get('/pokemon/:species/encounters', (req: Request, res: Response) => {
  try {
    const speciesId = parseInt(req.params.species);
    if (isNaN(speciesId)) {
      return res.status(400).json({ error: 'ID de especie inválido' });
    }

    const form = parseInt(String(req.query.form || '0'));
    const version = String(req.query.version || '');

    let list = loadEncounters('za', speciesId, form);
    if (version) {
      list = list.filter(e => versionAllowed(e, version));
    }

    const results = list.map(e => getOptions('za', e));
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/za/validate
 * Validates a Pokémon combination.
 */
zaRouter.post('/validate', (req: Request, res: Response) => {
  try {
    const result = validate('za', req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default zaRouter;
