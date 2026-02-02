import { validateCoupon } from '../config/coupons.js'

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
    const { couponCode } = req.body

    if (!couponCode) {
      return res.status(400).json({ 
        error: 'Missing coupon code',
        valid: false
      })
    }

    console.log('Validating coupon code:', couponCode)

    // Validate using our custom coupon system
    const validation = validateCoupon(couponCode)

    if (!validation.valid) {
      return res.status(400).json({ 
        error: validation.error || 'Invalid coupon code',
        valid: false
      })
    }

    // Return coupon details
    return res.status(200).json({
      valid: true,
      coupon: validation.coupon,
      // For backwards compatibility with frontend
      promotionCodeId: validation.coupon.code, // Use code as ID since we don't need Stripe's ID
    })

  } catch (error) {
    console.error('Coupon validation error:', error)
    
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
      error: 'Failed to validate coupon',
      valid: false,
      details: error.message
    })
  }
}
