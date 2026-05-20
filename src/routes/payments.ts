import { Router, Response } from 'express'
import { getSupabase } from '../lib/supabase'

const router = Router()

/**
 * @swagger
 * /api/payments/update-plan:
 *   post:
 *     summary: Actualizar el plan de un usuario (Gratis / Premium)
 *     description: Endpoint seguro para que procesadores de pago (Stripe, PayPal, etc.) actualicen el rol del usuario.
 *     tags:
 *       - Payments
 *     parameters:
 *       - in: header
 *         name: x-payment-secret
 *         required: true
 *         schema:
 *           type: string
 *         description: Secreto de verificación para autorizar la actualización
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [plan]
 *             properties:
 *               email:
 *                 type: string
 *                 description: Email del usuario a actualizar (opcional si se provee userId)
 *               userId:
 *                 type: string
 *                 description: ID de Supabase del usuario a actualizar (opcional si se provee email)
 *               plan:
 *                 type: string
 *                 enum: [free, premium]
 *                 description: El nuevo plan para asignar al usuario
 *     responses:
 *       200:
 *         description: Plan actualizado correctamente
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado (Secret inválido)
 *       404:
 *         description: Usuario no encontrado
 *       500:
 *         description: Error interno
 */
router.post('/update-plan', async (req: any, res: Response) => {
  try {
    const secret = req.headers['x-payment-secret']
    const expectedSecret = process.env.PAYMENT_WEBHOOK_SECRET

    if (!expectedSecret) {
      console.error('[payments/update-plan] ERROR: PAYMENT_WEBHOOK_SECRET is not configured in .env')
      return res.status(500).json({ error: 'Payment service not properly configured' })
    }

    if (secret !== expectedSecret) {
      console.warn('[payments/update-plan] Unauthorized access attempt with invalid secret')
      return res.status(401).json({ error: 'Unauthorized: Invalid payment secret' })
    }

    const { email, userId, plan } = req.body

    if (!plan || !['free', 'premium'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan: must be "free" or "premium"' })
    }

    if (!email && !userId) {
      return res.status(400).json({ error: 'Either email or userId must be provided' })
    }

    const supabase = getSupabase()
    let targetUserId = userId

    // If only email is provided, lookup the user id in Supabase
    if (!targetUserId && email) {
      console.log(`[payments/update-plan] Looking up user ID for email: ${email}`)
      const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()

      if (listError) {
        console.error('[payments/update-plan] Error listing users from Supabase admin:', listError)
        return res.status(500).json({ error: 'Failed to query users database' })
      }

      const foundUser = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase())
      if (!foundUser) {
        console.warn(`[payments/update-plan] No user found with email: ${email}`)
        return res.status(404).json({ error: `User with email ${email} not found` })
      }

      targetUserId = foundUser.id
    }

    console.log(`[payments/update-plan] Updating user ${targetUserId} metadata to plan: ${plan}`)
    
    // Update app_metadata of the user
    const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
      targetUserId,
      { app_metadata: { plan } }
    )

    if (updateError) {
      console.error('[payments/update-plan] Supabase update user error:', updateError)
      return res.status(500).json({ error: 'Failed to update user subscription status' })
    }

    console.log(`[payments/update-plan] Successfully upgraded user ${targetUserId} to plan: ${plan}`)
    return res.status(200).json({
      success: true,
      message: `User subscription plan updated to ${plan} successfully`,
      user: {
        id: updatedUser.user.id,
        email: updatedUser.user.email,
        plan: updatedUser.user.app_metadata?.plan
      }
    })

  } catch (err: any) {
    console.error('[payments/update-plan] Unexpected error:', err)
    return res.status(500).json({ error: 'Internal server error processing payment request' })
  }
})

/**
 * @swagger
 * /api/payments/stripe-webhook:
 *   post:
 *     summary: Esqueleto de webhook para Stripe
 *     description: Endpoint preparado para recibir notificaciones directas de eventos de Stripe Checkout
 *     tags:
 *       - Payments
 */
router.post('/stripe-webhook', async (req: any, res: Response) => {
  // Skeleton ready for Stripe Checkout session completion
  // When ready to use:
  // 1. Install stripe: npm install stripe
  // 2. Read rawBody/signature and use stripe.webhooks.constructEvent
  // 3. Extract customer email or metadata.userId
  // 4. Update via supabase auth admin API
  console.log('[stripe-webhook] Webhook endpoint touched. Ready for direct Stripe integration.')
  return res.status(200).json({ received: true, note: 'Ready for production connection' })
})

export default router
