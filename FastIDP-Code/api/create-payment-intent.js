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
    const { applicationId, formData } = req.body

    if (!applicationId) {
      return res.status(400).json({ error: 'Missing applicationId' })
    }

    console.log('Creating payment intent for application:', applicationId)

    const permitCount = formData.selectedPermits?.length || 1
    const permitTotal = permitCount * PERMIT_PRICES.idp

    const category = formData.shippingCategory || 'domestic'
    const speed = formData.processingOption || 'standard'
    const combinedPrice = getCombinedPriceCents(category, speed) / 100

    const subtotal = permitTotal + combinedPrice
    const taxAmount = Math.round(subtotal * TAX.rate * 100) / 100
    const totalBeforeDiscount = subtotal + taxAmount

    // Calculate discount if coupon code is provided (using our custom coupon system)
    let discountAmount = 0
    let finalAmount = totalBeforeDiscount
    
    // Check if we have coupon data from validation (could be code or coupon object)
    const couponCode = formData.couponCode || formData.validatedPromotionCodeId
    
    if (couponCode) {
      try {
        // Validate coupon using our custom system
        const validation = validateCoupon(couponCode)
        
        if (validation.valid && validation.coupon) {
          const coupon = validation.coupon
          
          if (coupon.percent_off) {
            // Percentage discount
            discountAmount = Math.round(totalBeforeDiscount * (coupon.percent_off / 100) * 100) / 100
          } else if (coupon.amount_off) {
            // Fixed amount discount (already in dollars from our system)
            discountAmount = coupon.amount_off / 100
          }
          
          finalAmount = Math.max(0, totalBeforeDiscount - discountAmount)
          
          // Ensure finalAmount respects Stripe minimum if discount was applied
          if (finalAmount > 0 && finalAmount < 0.50) {
            finalAmount = 0.50
          }
          
          console.log('Discount calculation:', {
            couponCode: coupon.code,
            couponType: coupon.percent_off ? 'percent' : 'amount',
            percentOff: coupon.percent_off,
            amountOff: coupon.amount_off,
            totalBeforeDiscount,
            discountAmount,
            finalAmount
          })
        }
      } catch (error) {
        console.error('Error calculating discount:', error)
        // Continue without discount if there's an error
      }
    }

    let amountInCents = Math.round(finalAmount * 100)

    console.log('Payment calculation:', {
      permits: permitCount,
      permitTotal,
      combinedPrice,
      subtotal,
      taxAmount,
      totalBeforeDiscount,
      discountAmount,
      finalAmount,
      amountInCents,
      couponCode: couponCode || 'none'
    })

    // Stripe requires minimum $0.50 - if discount makes it below that, use minimum
    if (amountInCents < 50) {
      console.log(`Amount ${amountInCents} cents is below Stripe minimum of 50 cents, using minimum`)
      amountInCents = 50 // Use Stripe's minimum
      finalAmount = 0.50
    }

    const paymentIntentParams = {
      amount: amountInCents,
      currency: 'usd',
      payment_method_types: ['card'],
      payment_method_options: {
        card: {
          request_three_d_secure: 'automatic'
        }
      },
      metadata: {
        applicationId: applicationId,
        customer_email: formData.email,
        customer_name: `${formData.firstName} ${formData.lastName}`,
        permit_count: permitCount.toString(),
        shipping_category: category,
        processing_speed: speed,
      },
      description: `IDP Application - ${applicationId}`,
    }

    // Track coupon code in metadata (discount is already applied to amount)
    if (couponCode) {
      paymentIntentParams.metadata.coupon_code = couponCode
      paymentIntentParams.metadata.discount_applied = discountAmount > 0 ? 'true' : 'false'
      paymentIntentParams.metadata.discount_amount = discountAmount.toString()
      console.log('Coupon code tracked in metadata:', couponCode, 'Discount amount:', discountAmount)
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams)

    console.log('Payment intent created:', paymentIntent.id)

    return res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    })

  } catch (error) {
    console.error('Payment intent creation error:', error)
    
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
    
    // Check for API key errors specifically
    if (error.type === 'StripeAuthenticationError' || error.message?.includes('Invalid API Key')) {
      return res.status(500).json({
        error: 'Stripe configuration error',
        message: 'Invalid Stripe API key. Please check that STRIPE_SECRET_KEY is set to a valid secret key (sk_live_*) in Vercel environment variables.',
        details: error.message
      })
    }
    
    return res.status(500).json({
      error: 'Failed to create payment intent',
      details: error.message
    })
  }
}
