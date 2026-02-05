/**
 * SINGLE SOURCE OF TRUTH FOR ALL PRICING
 * 
 * When switching to LIVE mode or updating prices:
 * 1. Update prices in this file only
 * 2. Update STRIPE_PRODUCTS if using Stripe Products (currently not used)
 * 3. Push to production
 * 
 * Last updated: November 26, 2025
 * Source: Fast IDP Pricing 11_26_25 sheet
 */

// ============================================
// PERMIT PRICES
// ============================================
export const PERMIT_PRICES = {
  idp: 20,           // International Driving Permit
  iapd: 20,          // IAPD (Brazil / Uruguay only)
}

// ============================================
// PROCESSING COSTS (standalone - for reference)
// ============================================
export const PROCESSING_COSTS = {
  standard: 49,      // 3-5 business days
  fast: 89,          // 1-2 business days
  fastest: 119,      // Same day / next day
}

// ============================================
// SHIPPING COSTS (standalone - for reference)
// ============================================
export const SHIPPING_COSTS = {
  international: {
    standard: 49,
    fast: 59,
    fastest: 79,
  },
  domestic: {
    standard: 9,
    fast: 19,
    fastest: 49,
  },
  territories: {
    standard: 9,
    fast: 19,
    fastest: 49,
  },
  military: {
    standard: 0,     // Free shipping for military
    fast: 0,
    fastest: 0,
  },
}

// ============================================
// COMBINED PRICING (what customer pays)
// Processing + Shipping = Total
// ============================================
export const COMBINED_PRICING = {
  international: {
    standard: 98,    // $49 processing + $49 shipping
    fast: 148,       // $89 processing + $59 shipping
    fastest: 198,    // $119 processing + $79 shipping
  },
  domestic: {
    standard: 58,    // $49 processing + $9 shipping
    fast: 108,       // $89 processing + $19 shipping
    fastest: 168,    // $119 processing + $49 shipping
  },
  territories: {
    standard: 58,    // $49 processing + $9 shipping
    fast: 108,       // $89 processing + $19 shipping
    fastest: 168,    // $119 processing + $49 shipping
  },
  military: {
    standard: 49,    // $49 processing + $0 shipping
    fast: 89,        // $89 processing + $0 shipping
    fastest: 119,    // $119 processing + $0 shipping
  },
}

// ============================================
// DELIVERY TIMELINES
// ============================================
export const DELIVERY_TIMELINES = {
  international: {
    standard: {
      processingMin: 3,
      processingMax: 3,
      shippingMin: 4,
      shippingMax: 7,
      totalMin: 7,
      totalMax: 10,
      note: null,
    },
    fast: {
      processingMin: 1,
      processingMax: 2,
      shippingMin: 3,
      shippingMax: 5,
      totalMin: 4,
      totalMax: 7,
      note: null,
    },
    fastest: {
      processingMin: 0,
      processingMax: 1,
      shippingMin: 2,
      shippingMax: 4,
      totalMin: 2,
      totalMax: 5,
      note: "Contact us to check on shipping timeline to your specific US destination, as timelines vary",
    },
  },
  domestic: {
    standard: {
      processingMin: 3,
      processingMax: 3,
      shippingMin: 3,
      shippingMax: 5,
      totalMin: 6,
      totalMax: 8,
      note: null,
    },
    fast: {
      processingMin: 1,
      processingMax: 2,
      shippingMin: 2,
      shippingMax: 2,
      totalMin: 3,
      totalMax: 4,
      note: null,
    },
    fastest: {
      processingMin: 0,
      processingMax: 1,
      shippingMin: 1,
      shippingMax: 1,
      totalMin: 1,
      totalMax: 2,
      note: null,
    },
  },
  territories: {
    standard: {
      processingMin: 3,
      processingMax: 5,
      shippingMin: 5,
      shippingMax: 10,
      totalMin: 8,
      totalMax: 15,
      note: "Contact us to check on shipping timeline to your specific US Territories destination, as timelines vary",
    },
    fast: {
      processingMin: 1,
      processingMax: 2,
      shippingMin: 5,
      shippingMax: 10,
      totalMin: 6,
      totalMax: 12,
      note: "Contact us to check on shipping timeline to your specific US Territories destination, as timelines vary",
    },
    fastest: {
      processingMin: 0,
      processingMax: 1,
      shippingMin: 5,
      shippingMax: 10,
      totalMin: 5,
      totalMax: 11,
      note: "Contact us to check on shipping timeline to your specific US Territories destination, as timelines vary",
    },
  },
  military: {
    standard: {
      processingMin: 3,
      processingMax: 3,
      shippingMin: 5,
      shippingMax: 12,
      totalMin: 8,
      totalMax: 15,
      note: null,
    },
    fast: {
      processingMin: 1,
      processingMax: 2,
      shippingMin: 5,
      shippingMax: 10,
      totalMin: 6,
      totalMax: 12,
      note: null,
    },
    fastest: {
      processingMin: 0,
      processingMax: 1,
      shippingMin: 5,
      shippingMax: 10,
      totalMin: 5,
      totalMax: 11,
      note: null,
    },
  },
}

// ============================================
// STRIPE PRODUCT IDS (TEST MODE)
// These are currently NOT used in payment flow
// When switching to LIVE, these would need to be updated
// ============================================
export const STRIPE_PRODUCTS = {
  // Permits
  idp_international: 'prod_StLB80b39cwGwe',
  idp_brazil_uruguay: 'prod_StL0mfYEghMQd7',
  
  // Legacy processing products (not used with embedded payments)
  processing_standard: 'prod_StLCI6MmfjwY8u',
  processing_express: 'prod_StLCgdjyMxHEkX',
  processing_same_day: 'prod_StLCyJMauosNpo',
}

// ============================================
// TAX CONFIGURATION
// ============================================
export const TAX = {
  rate: 0.0775,                              // 7.75%
  jurisdiction: 'Bellefontaine, OH',
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get combined price (in dollars) for a shipping category and speed
 */
export function getCombinedPrice(category, speed) {
  const normalizedCategory = category === 'domestic' ? 'domestic' : category
  return COMBINED_PRICING[normalizedCategory]?.[speed] || 0
}

/**
 * Get combined price in cents for Stripe
 */
export function getCombinedPriceCents(category, speed) {
  return getCombinedPrice(category, speed) * 100
}

/**
 * Get processing cost breakdown
 */
export function getProcessingCost(speed) {
  return PROCESSING_COSTS[speed] || 0
}

/**
 * Get shipping cost breakdown
 */
export function getShippingCost(category, speed) {
  const normalizedCategory = category === 'domestic' ? 'domestic' : category
  return SHIPPING_COSTS[normalizedCategory]?.[speed] || 0
}

/**
 * Get delivery timeline information
 */
export function getDeliveryTimeline(category, speed) {
  const normalizedCategory = category === 'domestic' ? 'domestic' : category
  return DELIVERY_TIMELINES[normalizedCategory]?.[speed] || null
}

/**
 * Get display name for speed option
 */
export function getSpeedDisplayName(speed) {
  const names = {
    standard: 'Standard Processing & Shipping',
    fast: 'Fast Processing & Shipping',
    fastest: 'Fastest Processing & Shipping',
  }
  return names[speed] || speed
}

/**
 * Calculate subtotal before tax
 */
export function calculateSubtotal(permits, category, speed) {
  let subtotal = 0
  
  // Add permit costs
  subtotal += permits.length * PERMIT_PRICES.idp
  
  // Add combined processing & shipping
  subtotal += getCombinedPrice(category, speed)
  
  return subtotal
}

/**
 * Calculate tax amount
 */
export function calculateTax(subtotal) {
  return Math.round(subtotal * TAX.rate * 100) / 100
}

/**
 * Calculate total with tax
 */
export function calculateTotal(permits, category, speed) {
  const subtotal = calculateSubtotal(permits, category, speed)
  const tax = calculateTax(subtotal)
  return subtotal + tax
}
