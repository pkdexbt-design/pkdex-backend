import { Router, Request, Response } from 'express'
import { getSupabase } from '../lib/supabase'

const router = Router()
export const ordersStore = new Map<string, any>()

/**
 * Maps items to ensure they contain numeric species IDs for the frontend
 * and friendly displayName strings.
 */
function mapItems(teamPayload: any[], gameVersion: string): any[] {
  const { games } = require('../lib/gameDb')
  return teamPayload.map((it: any) => {
    let resolvedDexId = it.dexId || it.speciesId
    
    // If species is already a number, that is the dexId
    if (typeof it.species === 'number') {
      resolvedDexId = it.species
    }
    
    if (!resolvedDexId && typeof it.species === 'string') {
      const nameLower = it.species.toLowerCase().trim()
      const gKey = (gameVersion === 'legends-za' || gameVersion === 'za') ? 'za' : 'sv'
      const pokemonList = games[gKey]?.pokemon || []
      const found = pokemonList.find((p: any) =>
        p.name.toLowerCase() === nameLower ||
        p.displayNameEn?.toLowerCase() === nameLower ||
        p.displayName?.toLowerCase() === nameLower
      )
      if (found) {
        resolvedDexId = Number(found.species)
      }
    }
    
    const numericSpecies = resolvedDexId ? Number(resolvedDexId) : 1
    
    let displayName = it.displayName
    if (!displayName) {
      if (typeof it.species === 'string') {
        displayName = it.species
      } else {
        const gKey = (gameVersion === 'legends-za' || gameVersion === 'za') ? 'za' : 'sv'
        const pokemonList = games[gKey]?.pokemon || []
        const found = pokemonList.find((p: any) => Number(p.species) === numericSpecies)
        displayName = found?.displayName || found?.name || 'Pokémon'
      }
    }

    return {
      ...it,
      status: it.status || 'pending',
      displayName,
      species: numericSpecies
    }
  })
}

/**
 * Loads an order from the Supabase database if not present in the memory store,
 * maps its columns, and initializes its visual tracking state.
 */
async function getOrInitOrder(orderId: string): Promise<any | null> {
  if (ordersStore.has(orderId)) {
    return ordersStore.get(orderId)
  }

  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (error || !data) {
      console.warn(`[publicOrders] Order ${orderId} not found in Supabase:`, error?.message)
      return null
    }

    const teamPayload = Array.isArray(data.team_payload) ? data.team_payload : [data.team_payload]
    const items = mapItems(teamPayload, data.game_version)
    const isBulk = items.length > 1

    const record = {
      id: data.id,
      user_id: data.user_id,
      game: data.game_version === 'legends-za' ? 'za' : 'sv',
      isBulk,
      tradeCode: data.trade_code,
      status: data.status,
      queuePosition: data.status === 'pending' ? 1 : null,
      items,
      logs: [
        {
          at: data.created_at || new Date().toISOString(),
          status: 'submitted',
          message: 'Pedido enviado. Esperando en cola...'
        }
      ],
      message: null,
      createdAt: data.created_at,
      updatedAt: new Date().toISOString()
    }

    ordersStore.set(orderId, record)
    return record
  } catch (err) {
    console.error(`[publicOrders] Exception loading order ${orderId}:`, err)
    return null
  }
}

/**
 * GET /api/orders/:id/status
 * Exposes order state to the trade room frontend.
 */
router.get('/:id/status', async (req: Request, res: Response) => {
  const { id } = req.params
  const record = await getOrInitOrder(id)
  if (!record) {
    return res.status(404).json({ error: 'Order not found' })
  }

  // Calculate remaining free trades if owner has a free plan
  let remainingFreeTrades = undefined
  try {
    const supabase = getSupabase()
    const { data: { user }, error: userErr } = await supabase.auth.admin.getUserById(record.user_id)
    if (!userErr && user) {
      const PAID_PLANS = ['gym', 'elite', 'champion', 'premium']
      const rawPlan = user.app_metadata?.plan || user.user_metadata?.plan || 'free'
      const isPremium = rawPlan && PAID_PLANS.includes(String(rawPlan).toLowerCase())
      const plan = isPremium ? String(rawPlan).toLowerCase() : 'free'

      if (plan === 'free') {
        const gameGroup = record.game === 'za' ? 'za' : 'sv'
        const startOfToday = new Date()
        startOfToday.setUTCHours(0,0,0,0)

        const { data: activeOrdersToday } = await supabase
          .from('orders')
          .select('game_version, status')
          .eq('user_id', user.id)
          .gte('created_at', startOfToday.toISOString())
          .not('status', 'in', '("failed","expired","cancelled")')

        const usedToday = (activeOrdersToday || []).filter((o: any) => {
          const oGroup = o.game_version === 'legends-za' ? 'za' : 'sv'
          return oGroup === gameGroup
        }).length

        remainingFreeTrades = Math.max(0, 3 - usedToday)
      }
    }
  } catch (err) {
    console.error(`[publicOrders] Failed to calculate remaining trades for order ${id}:`, err)
  }

  return res.json({ order: record, remainingFreeTrades })
})

/**
 * Updates the state of an order in memory (ordersStore) and updates Supabase.
 */
export async function updateOrderState(
  orderId: string,
  eventData: { status?: string; message?: string; items?: any[]; queuePosition?: number }
): Promise<any | null> {
  const record = await getOrInitOrder(orderId)
  if (!record) return null

  const { status, message, items, queuePosition } = eventData

  if (status) record.status = status
  if (queuePosition !== undefined) record.queuePosition = queuePosition
  if (message) record.message = message
  if (items && Array.isArray(items)) {
    record.items = mapItems(items, record.game)
  }

  // Append to logs
  const at = new Date().toISOString()
  record.logs.push({
    at,
    status: status || record.status,
    message: message || `Estado actualizado a ${status}`
  })

  record.updatedAt = at

  // Persist final/current status to Supabase if it's a known state
  if (status) {
    try {
      const supabase = getSupabase()
      await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId)

      // Release active trade lock in Redis if the order reaches a final status
      const FINAL_STATUSES = ['completed', 'failed', 'partial_failed', 'expired', 'cancelled']
      if (FINAL_STATUSES.includes(status.toLowerCase())) {
        const { connection: redis } = require('../queue/redis')
        const gameGroup = record.game === 'za' ? 'za' : 'sv'
        const lockKey = `active_trade:${record.user_id}:${gameGroup}`
        await redis.del(lockKey)
        console.log(`[publicOrders] Released Redis lock ${lockKey} for order ${orderId}`)
      }
    } catch (dbErr: any) {
      console.error(`[publicOrders] Failed to update status in Supabase for ${orderId}:`, dbErr.message || dbErr)
    }
  }

  return record
}

/**
 * POST /api/orders/:id/event
 * Allows the Discord listener / worker to publish status updates.
 */
router.post('/:id/event', async (req: Request, res: Response) => {
  const { id } = req.params
  const { status, message, items, queuePosition } = req.body

  console.log(`[publicOrders] Event received for order ${id}: status=${status}, message=${message}`)

  const record = await updateOrderState(id, { status, message, items, queuePosition })
  if (!record) {
    return res.status(404).json({ error: 'Order not found' })
  }

  return res.json({ ok: true, order: record })
})

export default router
