/**
 * Shipping carrier and EasyPost service by category, speed, and fulfillment.
 * See SHIPPING_SPEC.md. Service strings must match EasyPost rate object `service` field exactly.
 * FedEx: https://www.easypost.com/fedex-guide | USPS: https://www.easypost.com/usps-guide
 */

// EasyPost service names — must match rate.service from EasyPost API
const FEDEX_SERVICES = {
  fastest: 'PRIORITY_OVERNIGHT',
  fast: 'FEDEX_2_DAY',
  standard: 'FEDEX_2_DAY'
}
const FEDEX_INTERNATIONAL = 'FEDEX_INTERNATIONAL_PRIORITY'
const USPS_SERVICES = {
  fastest: 'Express',      // Priority Mail Express
  fast: 'Express',
  standard: 'Priority'     // Priority Mail
}

/**
 * @param {string} category - 'domestic' | 'international' | 'military'
 * @param {string} speed - 'standard' | 'fast' | 'fastest'
 * @param {string} fulfillmentType - 'automated' | 'manual'
 * @returns {{ carrier: string | null, requested_service: string | null }}
 */
export function getShippingCarrierAndService(category, speed, fulfillmentType) {
  if (category === 'military') {
    return { carrier: 'USPS', requested_service: USPS_SERVICES[speed] || USPS_SERVICES.standard }
  }
  if (category === 'domestic') {
    return { carrier: 'FedEx', requested_service: FEDEX_SERVICES[speed] || FEDEX_SERVICES.standard }
  }
  if (category === 'international') {
    if (fulfillmentType === 'automated') {
      return { carrier: 'FedEx', requested_service: FEDEX_INTERNATIONAL }
    }
    return { carrier: null, requested_service: null }
  }
  return { carrier: null, requested_service: null }
}
