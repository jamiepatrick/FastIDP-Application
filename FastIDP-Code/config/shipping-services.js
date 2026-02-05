/**
 * Shipping carrier and EasyPost service by category, speed, and fulfillment.
 * See SHIPPING_SPEC.md. Service strings must match EasyPost rate objects
 * (verify from a real Create Shipment response and update if needed).
 */

// EasyPost service names (carrier-specific)
const FEDEX_SERVICES = {
  fastest: 'FedEx Priority Overnight',
  fast: 'FedEx 2Day',
  standard: 'FedEx 2Day'
}
const FEDEX_INTERNATIONAL = 'FedEx International Priority'
const USPS_SERVICES = {
  fastest: 'Priority Express',
  fast: 'Priority Express',
  standard: 'Priority'
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
