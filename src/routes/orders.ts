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
      .select('id, trade_code, status, game_version, created_at, updated_at')
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

export default router
