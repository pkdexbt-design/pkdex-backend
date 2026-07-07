import { Router, Request, Response } from 'express'
import { getSupabase } from '../lib/supabase'
import { addOrderToQueue } from '../queue/OrderQueue'
import { validate } from '../lib/gameDb'
import { CreateOrderRequest, CreateOrderResponse } from '../lib/order-types'
import { AuthRequest } from '../middleware/auth'
import { updateOrderState } from './publicOrders'
import { connection as redis } from '../queue/redis'

const router = Router()

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Crear una nueva orden de intercambio
 *     description: Recibe el equipo Pokémon del usuario y lo guarda como orden pendiente en la base de datos
 *     tags:
 *       - Orders
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [team, tradeCode, gameVersion]
 *             properties:
 *               team:
 *                 type: array
 *                 description: Array de Pokémon en el equipo (1-6)
 *                 minItems: 1
 *                 maxItems: 6
 *               tradeCode:
 *                 type: string
 *                 description: Código de intercambio generado (ej. "1234 5678")
 *               gameVersion:
 *                 type: string
 *                 enum: [scarlet, violet]
 *     responses:
 *       201:
 *         description: Orden creada correctamente
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error interno
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    console.log('[orders POST] Request reached handler. user:', req.user?.id)
    const { team, tradeCode, gameVersion }: CreateOrderRequest = req.body
    console.log('[orders POST] team length:', team?.length, '| gameVersion:', gameVersion, '| tradeCode:', tradeCode)

    // ─── Validations ─────────────────────────────────────
    if (!team || !Array.isArray(team) || team.length === 0) {
      return res.status(400).json({ error: 'team must be a non-empty array' })
    }

    if (team.length > 6) {
      return res.status(400).json({ error: 'team cannot have more than 6 Pokémon' })
    }

    if (!tradeCode || typeof tradeCode !== 'string') {
      return res.status(400).json({ error: 'tradeCode is required' })
    }

    if (!gameVersion || !['scarlet', 'violet', 'legends-za'].includes(gameVersion)) {
      return res.status(400).json({ error: 'gameVersion must be "scarlet", "violet", or "legends-za"' })
    }

    if (!req.user?.id) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const userPlan = req.user?.plan ?? 'free'
    console.log(`[orders POST] user=${req.user.id} plan='${userPlan}' game=${gameVersion} teamSize=${team.length}`);

    // ─── Freemium limits & checks ────────────────────────
    // Free users can only request 1 Pokémon per order to prevent abuse.
    if (userPlan === 'free' && team.length > 1) {
      return res.status(403).json({
        error: 'free_plan_limit',
        message: 'El plan gratuito permite solicitar 1 Pokémon por pedido. Actualiza a Premium para pedir hasta 6 a la vez.',
        limit: 1,
        userPlan,
      })
    }

    const gameGroup = gameVersion === 'legends-za' ? 'za' : 'sv';

    // ─── Active Order Lock (Multi-tab protection) ────────
    const lockKey = `active_trade:${req.user.id}:${gameGroup}`;
    const activeOrderId = await redis.get(lockKey);
    if (activeOrderId) {
      return res.status(409).json({
        error: 'active_order_exists',
        message: 'Ya tienes un pedido activo para este juego. Completa o cancela tu pedido anterior antes de realizar uno nuevo.',
        activeOrderId
      });
    }

    // ─── Daily Limit Check for Free Users ────────────────
    if (userPlan === 'free') {
      const startOfToday = new Date();
      startOfToday.setUTCHours(0,0,0,0);

      const { data: activeOrdersToday, error: queryErr } = await getSupabase()
        .from('orders')
        .select('game_version, status')
        .eq('user_id', req.user.id)
        .gte('created_at', startOfToday.toISOString())
        .not('status', 'in', '("failed","expired","cancelled")');

      if (queryErr) {
        console.error('[orders POST] Error checking daily limit:', queryErr.message);
      } else {
        const usedToday = (activeOrdersToday || []).filter(o => {
          const oGroup = o.game_version === 'legends-za' ? 'za' : 'sv';
          return oGroup === gameGroup;
        }).length;

        if (usedToday >= 3) {
          return res.status(403).json({
            error: 'daily_limit_reached',
            message: 'Has alcanzado el límite de 3 intercambios diarios para este juego en el plan gratuito. Actualiza tu membresía para obtener intercambios ilimitados.'
          });
        }
      }
    }

    // Validate and correct levels (e.g. min evolution levels for SV starters)
    const gKey = gameVersion === 'legends-za' ? 'za' : 'sv';
    const validatedTeam = team.map((pokemon: any) => {
      const result = validate(gKey, pokemon);
      if (result.legal && result.order) {
        return result.order;
      }
      return pokemon;
    });

    // ─── Membership Tier Restrictions Validation ──────────
    for (const pokemon of validatedTeam) {
      const pokDexId = Number(pokemon.dexId ?? pokemon.speciesId ?? pokemon.species);
      console.log(`[orders POST] Checking membership for dexId=${pokDexId} (raw dexId=${pokemon.dexId}, species=${pokemon.species}) shiny=${pokemon.shiny} form=${pokemon.form} plan=${userPlan}`);
      const check = checkPokemonMembership(userPlan, gameVersion, pokemon);
      if (check && !check.allowed) {
        const errorMsg = getFriendlyMembershipErrorMessage(userPlan, check.minTier);
        console.log(`[orders POST] BLOCKED user=${req.user.id} dexId=${pokDexId} requires=${check.minTier} userPlan=${userPlan}`);
        return res.status(403).json({
          error: errorMsg,
          message: errorMsg,
          code: 'membership_restriction',
          minTier: check.minTier,
          groupName: check.groupName
        });
      }
      console.log(`[orders POST] ALLOWED dexId=${pokDexId} for plan=${userPlan}`);
    }

    // ─── Insert in Supabase ───────────────────────────────
    const { data, error } = await getSupabase()
      .from('orders')
      .insert({
        user_id: req.user.id,
        trade_code: tradeCode,
        team_payload: validatedTeam,
        game_version: gameVersion,
        status: 'pending',
      })
      .select('id, trade_code, status, created_at')
      .single()

    if (error) {
      console.error('Supabase insert error:', error)
      return res.status(500).json({ error: 'Failed to create order', details: error.message })
    }

    // Acquire Redis lock for 15 minutes (900 seconds)
    try {
      await redis.set(lockKey, data.id, 'EX', 900);
      console.log(`[orders POST] Redis lock set for ${lockKey} with order ${data.id}`);
    } catch (lockErr) {
      console.error('[orders POST] Failed to set Redis lock:', lockErr);
    }

    // Initialize order state in memory so the Discord bridge can match it by trade code
    await updateOrderState(data.id, { status: 'pending' })

    const response: CreateOrderResponse = {
      orderId: data.id,
      tradeCode: data.trade_code,
      status: 'pending',
      createdAt: data.created_at,
    }

    // ====== ENQUEUE THE ORDER (PSAS-13) ======
    try {
      await addOrderToQueue(data.id, gameVersion, validatedTeam, tradeCode, userPlan)
    } catch (queueErr) {
      console.error('[Orders] Failed to push order to Redis queue:', queueErr)
    }

    return res.status(201).json(response)
  } catch (err) {
    console.error('Orders route error:', err)
    return res.status(500).json({ error: 'Internal server error creating order' })
  }
})

/**
 * @swagger
 * /api/orders:
 *   get:
 *     summary: Obtener las órdenes del usuario autenticado
 *     tags:
 *       - Orders
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de órdenes
 *       401:
 *         description: No autorizado
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { data, error } = await getSupabase()
      .from('orders')
      .select('id, trade_code, status, game_version, team_payload, created_at, updated_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch orders', details: error.message })
    }

    return res.status(200).json({ orders: data })
  } catch (err) {
    console.error('Orders GET error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

function getPlanTierValue(plan: string): number {
  switch (String(plan).toLowerCase()) {
    case 'free': return 0;
    case 'gym': return 1;
    case 'elite': return 2;
    case 'champion':
    case 'premium': return 3;
    default: return 0;
  }
}

function checkPokemonMembership(userPlan: string, gameVersion: string, pokemon: any): { allowed: boolean; minTier: string; groupName: string } | null {
  const plan = String(userPlan).toLowerCase();
  const game = (gameVersion === 'legends-za' || gameVersion === 'za') ? 'za' : 'sv';
  const dexId = Number(pokemon.dexId ?? pokemon.speciesId ?? pokemon.species);
  const form = Number(pokemon.form || 0);
  const shiny = !!pokemon.shiny;

  const planValue = getPlanTierValue(plan);

  if (game === 'za') {
    // 1. ZA eventos basicos con archivo (minTier: lider/gym)
    const zaLiderShinies = [716, 717, 150, 719, 485, 491]; // Xerneas, Yveltal, Mewtwo, Diancie, Heatran, Darkrai
    if (zaLiderShinies.includes(dexId) && shiny) {
      if (planValue < 1) {
        return { allowed: false, minTier: 'gym', groupName: 'Eventos básicos ZA Shiny' };
      }
    }
    // Floette Flor Eterna (Form 5) is always blocked for free (minTier: gym)
    if (dexId === 670 && form === 5) {
      if (planValue < 1) {
        return { allowed: false, minTier: 'gym', groupName: 'Floette Flor Eterna' };
      }
    }

    // 2. ZA HOME/recompensa (minTier: alto_mando/elite)
    const zaAltoMandoShinies = [648, 647, 721]; // Meloetta, Keldeo, Volcanion
    if (zaAltoMandoShinies.includes(dexId) && (shiny || dexId === 721)) {
      if (planValue < 2) {
        return { allowed: false, minTier: 'elite', groupName: 'Recompensas HOME ZA' };
      }
    }
  } else {
    // SV Game
    // 3. SV 16 shiny evento con archivo fijo (minTier: lider/gym)
    const sv16Shiny = [144, 145, 146, 150, 243, 244, 245, 250, 382, 383, 384, 483, 484, 791, 792, 800];
    if (sv16Shiny.includes(dexId) && shiny) {
      if (planValue < 1) {
        return { allowed: false, minTier: 'gym', groupName: '16 Shiny de Evento SV' };
      }
    }

    // 4. SV otros archivos especiales (Koraidon, Miraidon, Wo-Chien, Chien-Pao, Ting-Lu, Chi-Yu, Meloetta shiny SV) (minTier: lider/gym)
    const svSpecialShiny = [1001, 1002, 1003, 1004, 1007, 1008];
    if ((svSpecialShiny.includes(dexId) && shiny) || (dexId === 648 && shiny)) {
      if (planValue < 1) {
        return { allowed: false, minTier: 'gym', groupName: 'Especiales / Shiny locked SV' };
      }
    }

    // 5. SV recompensas HOME/singulares superiores (minTier: alto_mando/elite)
    const svAltoMando = [493, 648, 647, 721, 801, 802, 893, 1025]; // Arceus, Meloetta, Keldeo, Volcanion, Magearna, Marshadow, Zarude, Pecharunt
    if (svAltoMando.includes(dexId)) {
      if (planValue < 2) {
        return { allowed: false, minTier: 'elite', groupName: 'Recompensas HOME / Singulares SV' };
      }
    }

    // 6. SV 36 HOME-only exactos (minTier: campeon/champion)
    const sv36HomeOnly = [
      151, 377, 378, 379, 385, 386, 480, 481, 482, 485, 486, 487, 488, 489, 490, 491, 492, 
      641, 642, 645, 719, 720, 888, 889, 890, 894, 895, 905
    ]; // Mew, Regirock, etc
    if (sv36HomeOnly.includes(dexId)) {
      if (planValue < 3) {
        return { allowed: false, minTier: 'champion', groupName: 'Pokémon de HOME-only SV' };
      }
    }

    // 7. SV evoluciones finales de iniciales shiny (minTier: campeon/champion)
    const svStarters = [
      3, 6, 9, 154, 157, 160, 254, 257, 260, 389, 392, 395, 497, 500, 503, 652, 655, 658,
      724, 727, 730, 812, 815, 818, 908, 911, 914
    ];
    if (svStarters.includes(dexId) && shiny) {
      if (planValue < 3) {
        return { allowed: false, minTier: 'champion', groupName: 'Iniciales Shiny SV' };
      }
    }
  }

  return null;
}

function getFriendlyMembershipErrorMessage(userPlan: string, minTier: string): string {
  const isFree = String(userPlan).toLowerCase() === 'free';
  const tierNames: Record<string, string> = {
    gym: 'Líder de Gimnasio',
    elite: 'Alto Mando',
    champion: 'Campeón de Liga'
  };
  const requiredTierName = tierNames[minTier] || minTier;

  if (isFree) {
    return `Hazte miembro para obtener este Pokémon (${requiredTierName}).`;
  } else {
    return `Mejora tu membresía para obtener este Pokémon (${requiredTierName}).`;
  }
}

export default router
