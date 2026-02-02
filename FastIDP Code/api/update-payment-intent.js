import Stripe from 'stripe'
import { PERMIT_PRICES, getCombinedPriceCents, TAX } from '../config/pricing.js'
import { validateCoupon } from '../config/coupons.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  // Enhanced CORS configuration
  const allowedOrigins = [
    'https://fastidp.com',
    'https://www.fastidp.com',
    'http://localhost:3000',
    'https://localhost:3000'
  ]
  
  const origin = req.headers.origin
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://fastidp.com')
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { paymentIntentId, formData } = req.body

    if (!paymentIntentId) {
      return res.status(400).json({ error: 'Missing paymentIntentId' })
    }

    console.log('Updating payment intent:', paymentIntentId)

    // Retrieve the payment intent to check its status
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
    
    // Only update if payment intent is in a state that allows updates
    if (paymentIntent.status !== 'requires_payment_method' && paymentIntent.status !== 'requires_confirmation') {
      return res.status(400).json({ 
        error: 'Cannot update payment intent in current state',
        status: paymentIntent.status
      })
    }

    // Calculate the new amount with discount
    const permitCount = formData.selectedPermits?.length || 1
    const permitTotal = permitCount * PERMIT_PRICES.idp

    const category = formData.shippingCategory || 'domestic'
    const speed = formData.processingOption || 'standard'
    const combinedPrice = getCombinedPriceCents(category, speed) / 100

    const subtotal = permitTotal + combinedPrice
    const taxAmount = Math.round(subtotal * TAX.rate * 100) / 100
    const totalBeforeDiscount = subtotal + taxAmount

    // Calculate discount if coupon code is provided
    let discountAmount = 0
    let finalAmount = totalBeforeDiscount
    
    const couponCode = formData.couponCode
    
    if (couponCode) {
      try {
        const validation = validateCoupon(couponCode)
        
        if (validation.valid && validation.coupon) {
          const coupon = validation.coupon
          
          if (coupon.percent_off) {
            discountAmount = Math.round(totalBeforeDiscount * (coupon.percent_off / 100) * 100) / 100
          } else if (coupon.amount_off) {
            discountAmount = coupon.amount_off / 100
          }
          
          finalAmount = Math.max(0, totalBeforeDiscount - discountAmount)
          
          // Ensure finalAmount respects Stripe minimum
          if (finalAmount > 0 && finalAmount < 0.50) {
            finalAmount = 0.50
          }
        }
      } catch (error) {
        console.error('Error calculating discount:', error)
      }
    }

    let amountInCents = Math.round(finalAmount * 100)

    // Ensure minimum
    if (amountInCents < 50) {
      amountInCents = 50
      finalAmount = 0.50
    }

    // Update payment intent amount
    const updatedPaymentIntent = await stripe.paymentIntents.update(paymentIntentId, {
      amount: amountInCents,
      metadata: {
        ...paymentIntent.metadata,
        coupon_code: couponCode || '',
        discount_applied: discountAmount > 0 ? 'true' : 'false',
        discount_amount: discountAmount.toString(),
      }
    })

    console.log('Payment intent updated:', updatedPaymentIntent.id, 'New amount:', amountInCents)

    return res.status(200).json({
      success: true,
      paymentIntentId: updatedPaymentIntent.id,
      amount: amountInCents,
      clientSecret: updatedPaymentIntent.client_secret,
    })

  } catch (error) {
    console.error('Payment intent update error:', error)
    
    // Ensure CORS headers are set even in error responses
    const origin = req.headers.origin
    const allowedOrigins = [
      'https://fastidp.com',
      'https://www.fastidp.com',
      'http://localhost:3000',
      'https://localhost:3000'
    ]
    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
    } else {
      res.setHeader('Access-Control-Allow-Origin', 'https://fastidp.com')
    }
    
    return res.status(500).json({
      error: 'Failed to update payment intent',
      details: error.message
    })
  }
}

