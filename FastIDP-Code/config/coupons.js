// Custom coupon system
// Define your coupon codes here

export const COUPONS = {
  // FREE coupon with 98% discount
  FREE: {
    code: 'FREE',
    name: 'Free Coupon',
    type: 'percent', // 'percent' or 'amount'
    value: 98, // 98% off, or dollar amount if type is 'amount'
    active: true,
    expiresAt: null, // null for no expiration, or timestamp (milliseconds)
    maxUses: null, // null for unlimited, or number
    currentUses: 0, // Track usage (would be in database in production)
  },
  // Add more coupons here as needed
  // Example fixed amount discount:
  // 'SAVE10': {
  //   code: 'SAVE10',
  //   name: 'Save $10',
  //   type: 'amount',
  //   value: 10.00, // $10 off
  //   active: true,
  //   expiresAt: null,
  //   maxUses: null,
  //   currentUses: 0,
  // },
}

/**
 * Get a coupon by code (case-insensitive)
 */
export function getCouponByCode(code) {
  if (!code) return null
  const upperCode = code.toUpperCase().trim()
  const coupon = COUPONS[upperCode]
  
  if (!coupon || !coupon.active) {
    return null
  }
  
  // Check expiration
  if (coupon.expiresAt && coupon.expiresAt < Date.now()) {
    return null
  }
  
  // Check usage limits
  if (coupon.maxUses && coupon.currentUses >= coupon.maxUses) {
    return null
  }
  
  return coupon
}

/**
 * Validate a coupon code
 */
export function validateCoupon(code) {
  const coupon = getCouponByCode(code)
  
  if (!coupon) {
    return {
      valid: false,
      error: 'Invalid or expired coupon code'
    }
  }
  
  return {
    valid: true,
    coupon: {
      code: coupon.code,
      name: coupon.name,
      type: coupon.type,
      value: coupon.value,
      percent_off: coupon.type === 'percent' ? coupon.value : null,
      amount_off: coupon.type === 'amount' ? coupon.value * 100 : null, // Convert to cents for consistency
    }
  }
}

