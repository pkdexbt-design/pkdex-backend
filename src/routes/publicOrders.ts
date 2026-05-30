import { Router, Request, Response } from 'express'
import { getSupabase } from '../lib/supabase'

const router = Router()
export const ordersStore = new Map<string, any>()

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
    const items = teamPayload.map((it: any) => ({
      ...it,
      status: it.status || 'pending',
      displayName: it.displayName || it.species || 'Pokémon'
    }))

    const isBulk = items.length > 1

    const record = {
      id: data.id,
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
  return res.json({ order: record })
})

/**
 * POST /api/orders/:id/event
 * Allows the Discord listener / worker to publish status updates.
 */
router.post('/:id/event', async (req: Request, res: Response) => {
  const { id } = req.params
  const { status, message, items, queuePosition } = req.body

  console.log(`[publicOrders] Event received for order ${id}: status=${status}, message=${message}`)

  const record = await getOrInitOrder(id)
  if (!record) {
    return res.status(404).json({ error: 'Order not found' })
  }

  if (status) record.status = status
  if (queuePosition !== undefined) record.queuePosition = queuePosition
  if (items && Array.isArray(items)) {
    record.items = items.map((it: any) => ({
      ...it,
      status: it.status || 'pending',
      displayName: it.displayName || it.species || 'Pokémon'
    }))
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
        .eq('id', id)
    } catch (dbErr) {
      console.error(`[publicOrders] Failed to update status in Supabase for ${id}:`, dbErr)
    }
  }

  return res.json({ ok: true, order: record })
})

export default router
