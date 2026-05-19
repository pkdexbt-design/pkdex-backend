import { Router, Request, Response } from 'express';
import { games, loadEncounters, getOptions, validate, versionAllowed } from '../lib/gameDb';

const svRouter = Router();

/**
 * GET /api/sv/pokemon
 * List of available Pokémon species and forms in Scarlet / Violet.
 */
svRouter.get('/pokemon', (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || '').toLowerCase().trim();
    const method = String(req.query.method || '').toLowerCase().trim();
    let list = games.sv.pokemon;

    if (q) {
      list = list.filter(p => 
        String(p.species) === q || 
        [p.displayName, p.displayNameEn, p.name, p.nameEn, p.formLabel, ...(p.searchAliases || [])]
          .some(v => String(v || '').toLowerCase().includes(q))
      );
    }
    if (method) {
      list = list.filter(p => (p.methods || []).some((x: any) => String(x).toLowerCase() === method));
    }

    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sv/pokemon/:species/encounters
 * Returns legal encounters for the given species ID.
 * Optional query parameter: form (number)
 */
svRouter.get('/pokemon/:species/encounters', (req: Request, res: Response) => {
  try {
    const speciesId = parseInt(req.params.species);
    if (isNaN(speciesId)) {
      return res.status(400).json({ error: 'ID de especie inválido' });
    }

    const form = parseInt(String(req.query.form || '0'));
    const version = String(req.query.version || '');

    let list = loadEncounters('sv', speciesId, form);
    if (version) {
      list = list.filter(e => versionAllowed(e, version));
    }

    const results = list.map(e => getOptions('sv', e));
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/sv/validate
 * Validates a Pokémon combination.
 */
svRouter.post('/validate', (req: Request, res: Response) => {
  try {
    const result = validate('sv', req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default svRouter;
