import { Router, Response } from 'express'
import { getSupabase } from '../lib/supabase'
import Stripe from 'stripe'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()

// Initialize Stripe Client lazily to prevent server from crashing on boot if key is missing
let stripeInstance: any = null;
function getStripe(): any {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not configured in environment variables');
    }
    stripeInstance = new Stripe(key, {
      apiVersion: '2023-10-16' as any
    });
  }
  return stripeInstance;
}


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
 * /api/payments/create-checkout-session:
 *   post:
 *     summary: Crear una sesión de pago en Stripe
 *     description: Permite generar una sesión de Stripe Checkout para suscripción o pago único.
 *     tags:
 *       - Payments
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [priceId, userId]
 *             properties:
 *               priceId:
 *                 type: string
 *                 description: ID de precio o producto de Stripe (ej. price_xxx)
 *               userId:
 *                 type: string
 *                 description: ID del usuario en Supabase
 *               successUrl:
 *                 type: string
 *               cancelUrl:
 *                 type: string
 *               mode:
 *                 type: string
 *                 enum: [subscription, payment]
 *     responses:
 *       200:
 *         description: Sesión de checkout creada
 *       400:
 *         description: Datos inválidos
 *       500:
 *         description: Error al crear la sesión
 */
router.post('/create-checkout-session', async (req: any, res: Response) => {
  try {
    let { priceId, userId, successUrl, cancelUrl, mode = 'subscription', planId, billing } = req.body

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' })
    }

    if (!priceId && planId) {
      const cycle = billing === 'annual' ? 'annual' : 'monthly'
      const key = `${planId}_${cycle}`
      const envKey = `STRIPE_PRICE_${planId.toUpperCase()}_${cycle.toUpperCase()}`
      priceId = process.env[envKey]

      if (!priceId) {
        return res.status(400).json({ error: `Stripe Price ID not configured for ${key} (env variable ${envKey} is missing)` })
      }
    }

    if (!priceId) {
      return res.status(400).json({ error: 'Missing priceId or planId' })
    }

    console.log(`[payments/checkout] Creating checkout session for user ${userId} with price ${priceId}`)

    const session = await getStripe().checkout.sessions.create({
      mode: mode,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      client_reference_id: userId,
      success_url: successUrl || `${req.protocol}://${req.get('host')}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${req.protocol}://${req.get('host')}/memberships.html`,
    })

    return res.status(200).json({ id: session.id, url: session.url })
  } catch (err: any) {
    console.error('[payments/checkout] Error creating checkout session:', err)
    return res.status(500).json({ error: err.message || 'Internal Stripe error' })
  }
})

/**
 * @swagger
 * /api/payments/stripe-webhook:
 *   post:
 *     summary: Webhook real de Stripe para recibir confirmaciones de compra
 *     description: Actualiza de forma segura el rol del usuario a 'premium' en Supabase tras completarse la compra.
 *     tags:
 *       - Payments
 */
router.post('/stripe-webhook', async (req: any, res: Response) => {
  const sig = req.headers['stripe-signature']
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!sig || !webhookSecret) {
    console.error('[stripe-webhook] Missing stripe-signature header or STRIPE_WEBHOOK_SECRET in .env')
    return res.status(400).send('Webhook Error: Missing signature or secret configuration')
  }

  let event: any

  try {
    event = getStripe().webhooks.constructEvent(req.rawBody, sig, webhookSecret)
  } catch (err: any) {
    console.error(`[stripe-webhook] Signature verification failed: ${err.message}`)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  console.log(`[stripe-webhook] Received event type: ${event.type}`)

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any
    const userId = session.client_reference_id
    const customerEmail = session.customer_details?.email

    console.log(`[stripe-webhook] Checkout completed for session ${session.id}. User: ${userId}, Email: ${customerEmail}`)

    const supabase = getSupabase()
    let targetUserId = userId

    try {
      // Fallback: If no client_reference_id is provided, try searching for the user by their email address
      if (!targetUserId && customerEmail) {
        console.log(`[stripe-webhook] Attempting to resolve user ID by customer email: ${customerEmail}`)
        const { data, error: listError } = await supabase.auth.admin.listUsers()
        if (!listError && data?.users) {
          const foundUser = data.users.find((u: any) => u.email?.toLowerCase() === customerEmail.toLowerCase())
          if (foundUser) {
            targetUserId = foundUser.id
            console.log(`[stripe-webhook] Resolved user ID to: ${targetUserId}`)
          }
        }
      }

      if (targetUserId) {
        console.log(`[stripe-webhook] Upgrading user ${targetUserId} to plan: premium`)
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          targetUserId,
          { app_metadata: { plan: 'premium' } }
        )

        if (updateError) {
          console.error(`[stripe-webhook] Error updating user metadata in Supabase:`, updateError)
          return res.status(500).send('Database update failed')
        }

        console.log(`[stripe-webhook] ✅ Upgrade successful for user ${targetUserId}`)
      } else {
        console.error('[stripe-webhook] ❌ Could not resolve user ID from metadata or email')
      }
    } catch (err: any) {
      console.error('[stripe-webhook] Supabase admin operation failed:', err)
      return res.status(500).send('Supabase interaction failed')
    }
  }

  return res.status(200).json({ received: true })
})

/**
 * @swagger
 * /api/payments/test-change-plan:
 *   post:
 *     summary: Cambiar el plan del usuario autenticado (para pruebas)
 *     tags:
 *       - Payments
 *     security:
 *       - bearerAuth: []
 */
router.post('/test-change-plan', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id
    const { plan } = req.body

    const ALLOWED_PLANS = ['free', 'gym', 'elite', 'champion', 'premium']
    if (!plan || !ALLOWED_PLANS.includes(String(plan).toLowerCase())) {
      return res.status(400).json({ error: 'Plan inválido' })
    }

    if (!userId) {
      return res.status(401).json({ error: 'Usuario no autenticado' })
    }

    const supabase = getSupabase()
    console.log(`[payments/test-change-plan] Updating user ${userId} to plan: ${plan}`)

    const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
      userId,
      { app_metadata: { plan: plan.toLowerCase() } }
    )

    if (updateError) {
      console.error('[payments/test-change-plan] Supabase update user error:', updateError)
      return res.status(500).json({ error: 'No se pudo actualizar el plan en Supabase' })
    }

    return res.status(200).json({
      success: true,
      message: `Plan actualizado a ${plan} correctamente`,
      plan: updatedUser.user.app_metadata?.plan
    })
  } catch (err: any) {
    console.error('[payments/test-change-plan] Unexpected error:', err)
    return res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
