import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

// Country name to code mapping for normalizing country codes
const COUNTRY_NAME_TO_CODE = {
  'australia': 'AU',
  'austria': 'AT', 
  'belgium': 'BE',
  'canada': 'CA',
  'denmark': 'DK',
  'finland': 'FI',
  'france': 'FR',
  'germany': 'DE',
  'ireland': 'IE',
  'italy': 'IT',
  'luxembourg': 'LU',
  'mexico': 'MX',
  'netherlands': 'NL',
  'new zealand': 'NZ',
  'norway': 'NO',
  'portugal': 'PT',
  'spain': 'ES',
  'sweden': 'SE',
  'switzerland': 'CH',
  'united kingdom': 'GB',
  'uk': 'GB',
  'great britain': 'GB',
  'england': 'GB',
  'scotland': 'GB',
  'wales': 'GB',
  'northern ireland': 'GB',
  'usa': 'US',
  'united states': 'US',
  'united states of america': 'US',
  'america': 'US',
}

// Helper function to normalize country to 2-character code
function normalizeCountryCode(country) {
  if (!country || typeof country !== 'string') {
    return null
  }
  
  const countryLower = country.toLowerCase().trim()
  
  // If already a 2-character code, return uppercase
  if (countryLower.length === 2 && /^[a-z]{2}$/.test(countryLower)) {
    return countryLower.toUpperCase()
  }
  
  // Check if it's a known country name (exact match)
  if (COUNTRY_NAME_TO_CODE[countryLower]) {
    return COUNTRY_NAME_TO_CODE[countryLower]
  }
  
  // Try to find partial match
  for (const [countryName, countryCode] of Object.entries(COUNTRY_NAME_TO_CODE)) {
    if (countryLower.includes(countryName) || countryName.includes(countryLower)) {
      return countryCode
    }
  }
  
  // Additional common variations
  const additionalMappings = {
    'britain': 'GB',
    'british': 'GB',
    'u.k.': 'GB',
    'u.k': 'GB',
  }
  
  if (additionalMappings[countryLower]) {
    return additionalMappings[countryLower]
  }
  
  // If we can't match, return null
  return null
}

// Helper function to extract country from address string
function extractCountryFromAddress(addressString) {
  if (!addressString || typeof addressString !== 'string') {
    return null
  }
  
  const lines = addressString.trim().split('\n').map(line => line.trim()).filter(line => line.length > 0)
  if (lines.length === 0) {
    return null
  }
  
  // Check last line first (most common format)
  const lastLine = lines[lines.length - 1].toLowerCase().trim()
  
  // Check if it's already a country code
  if (lastLine.length === 2 && /^[a-z]{2}$/.test(lastLine)) {
    return lastLine.toUpperCase()
  }
  
  // Check if last line matches a known country name
  if (COUNTRY_NAME_TO_CODE[lastLine]) {
    return COUNTRY_NAME_TO_CODE[lastLine]
  }
  
  // Search through all lines for country mentions (reverse order)
  for (let i = lines.length - 1; i >= 0; i--) {
    const lineLower = lines[i].toLowerCase().trim()
    
    // Check for exact country name matches
    for (const [countryName, countryCode] of Object.entries(COUNTRY_NAME_TO_CODE)) {
      if (lineLower === countryName || lineLower.includes(countryName)) {
        return countryCode
      }
    }
    
    // Check for country code
    const possibleCode = lines[i].trim().toUpperCase()
    if (possibleCode.length === 2 && /^[A-Z]{2}$/.test(possibleCode)) {
      return possibleCode
    }
  }
  
  return null
}

// Helper function to parse international address into components
// Handles various formats: single-line, multi-line, comma-separated, etc.
// Works for all countries, not just UK
function parseInternationalAddress(fullAddress, countryCode = null) {
  if (!fullAddress || typeof fullAddress !== 'string') {
    return {
      line1: '',
      line2: '',
      city: '',
      postal_code: '',
      country: countryCode ? normalizeCountryCode(countryCode) || '' : ''
    }
  }
  
  // Extract country from address if not provided
  let normalizedCountry = countryCode ? normalizeCountryCode(countryCode) : null
  if (!normalizedCountry) {
    const extractedCountry = extractCountryFromAddress(fullAddress)
    normalizedCountry = extractedCountry ? normalizeCountryCode(extractedCountry) : null
  }
  
  // Split into lines
  const addressLines = fullAddress.split('\n').map(line => line.trim()).filter(line => line.length > 0)
  
  let line1 = ''
  let line2 = ''
  let city = ''
  let postal_code = ''
  
  if (addressLines.length === 1) {
    // Single-line address - try to parse comma-separated format
    const singleLine = addressLines[0]
    const parts = singleLine.split(',').map(p => p.trim()).filter(p => p.length > 0)
    
    if (parts.length >= 2) {
      // First part is usually street address
      line1 = parts[0]
      
      // Last part might be country - remove it if it matches a country name
      let lastPart = parts[parts.length - 1]
      const lastPartLower = lastPart.toLowerCase()
      if (COUNTRY_NAME_TO_CODE[lastPartLower] || (lastPart.length === 2 && /^[A-Z]{2}$/i.test(lastPart))) {
        // Last part is country, remove it from parsing
        parts.pop()
        lastPart = parts.length > 0 ? parts[parts.length - 1] : ''
      }
      
      // Try to extract postal code and city from remaining parts
      if (parts.length >= 2) {
        // Second-to-last part might be city + postal code
        const cityPostalPart = parts[parts.length - 1]
        
        // Try various postal code patterns for different countries
        const postalPatterns = [
          // UK: W1J 9BR, SW1A 1AA, M1 1AA
          /\b([A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2})\b/i,
          // Canadian: K1A 0B1, M5H 2N2
          /\b([A-Z]\d[A-Z]\s?\d[A-Z]\d)\b/i,
          // Australian: 2000, 3000 (4 digits)
          /\b(\d{4})\b/,
          // European (Germany, France, etc.): 10115, 75001 (5 digits)
          /\b(\d{5})\b/,
          // Netherlands: 1012 AB, 1234 AB
          /\b(\d{4}\s?[A-Z]{2})\b/i,
          // Swedish: 123 45
          /\b(\d{3}\s?\d{2})\b/,
          // Norwegian: 0001, 1234 (4 digits)
          /\b(\d{4})\b/,
          // Irish: D02 AF30, Dublin 2
          /\b([A-Z]\d{2}\s?[A-Z]{2}\d{2})\b/i,
          // Generic: any sequence that looks like a postal code
          /\b([A-Z0-9]{3,10})\b/i
        ]
        
        let postalMatch = null
        for (const pattern of postalPatterns) {
          postalMatch = cityPostalPart.match(pattern)
          if (postalMatch) {
            postal_code = postalMatch[1]
            city = cityPostalPart.replace(postalMatch[0], '').trim()
            break
          }
        }
        
        // If no postal code found, assume entire part is city
        if (!postalMatch) {
          city = cityPostalPart
        }
        
        // If there's a third part, it might be line2
        if (parts.length >= 3) {
          line2 = parts[parts.length - 2]
        }
      } else if (parts.length === 1) {
        // Only one part after removing country - might be city
        city = parts[0]
      }
    } else {
      // Can't parse comma-separated, use entire line as line1
      line1 = singleLine
    }
  } else {
    // Multi-line address
    line1 = addressLines[0] || ''
    line2 = addressLines.length > 1 ? addressLines[1] : ''
    
    // City is usually second-to-last line (before country)
    // Postal code might be on same line as city or separate
    if (addressLines.length >= 2) {
      const cityLineIndex = addressLines.length - 2
      const cityLine = addressLines[cityLineIndex]
      
      // Try to extract postal code from city line
      const postalPatterns = [
        /\b([A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2})\b/i, // UK
        /\b([A-Z]\d[A-Z]\s?\d[A-Z]\d)\b/i, // Canadian
        /\b(\d{4,5})\b/, // Australian/European
        /\b(\d{4}\s?[A-Z]{2})\b/i, // Netherlands
        /\b(\d{3}\s?\d{2})\b/, // Swedish
        /\b([A-Z]\d{2}\s?[A-Z]{2}\d{2})\b/i, // Irish
        /\b([A-Z0-9]{3,10})\b/i // Generic
      ]
      
      let postalMatch = null
      for (const pattern of postalPatterns) {
        postalMatch = cityLine.match(pattern)
        if (postalMatch) {
          postal_code = postalMatch[1]
          city = cityLine.replace(postalMatch[0], '').trim()
          break
        }
      }
      
      // If no postal code found, entire line is city
      if (!postalMatch) {
        city = cityLine
      }
    }
  }
  
  return {
    line1: line1,
    line2: line2,
    city: city,
    postal_code: postal_code,
    country: normalizedCountry || ''
  }
}

// Countries that require state/province field for EasyPost
// Based on EasyPost requirements: CA, AU, MX need state/province
// US is included for domestic shipments
const COUNTRIES_WITH_STATE = ['CA', 'AU', 'MX', 'US']

// State/Province code mappings for extraction from address text
const STATE_PROVINCE_CODES = {
  // Canada provinces
  'CA': {
    'alberta': 'AB', 'british columbia': 'BC', 'manitoba': 'MB', 'new brunswick': 'NB',
    'newfoundland': 'NL', 'northwest territories': 'NT', 'nova scotia': 'NS', 'nunavut': 'NU',
    'ontario': 'ON', 'prince edward island': 'PE', 'quebec': 'QC', 'saskatchewan': 'SK',
    'yukon': 'YT', 'ab': 'AB', 'bc': 'BC', 'mb': 'MB', 'nb': 'NB', 'nl': 'NL', 'nt': 'NT',
    'ns': 'NS', 'nu': 'NU', 'on': 'ON', 'pe': 'PE', 'qc': 'QC', 'sk': 'SK', 'yt': 'YT'
  },
  // Australia states
  'AU': {
    'new south wales': 'NSW', 'victoria': 'VIC', 'queensland': 'QLD', 'western australia': 'WA',
    'south australia': 'SA', 'tasmania': 'TAS', 'australian capital territory': 'ACT',
    'northern territory': 'NT', 'nsw': 'NSW', 'vic': 'VIC', 'qld': 'QLD', 'wa': 'WA',
    'sa': 'SA', 'tas': 'TAS', 'act': 'ACT', 'nt': 'NT'
  },
  // Mexico states (common ones - full list is extensive)
  'MX': {
    'aguascalientes': 'AG', 'baja california': 'BC', 'baja california sur': 'BS',
    'campeche': 'CM', 'chihuahua': 'CH', 'coahuila': 'CO', 'colima': 'CL',
    'distrito federal': 'DF', 'durango': 'DG', 'guanajuato': 'GJ', 'guerrero': 'GR',
    'hidalgo': 'HI', 'jalisco': 'JA', 'mexico': 'MX', 'michoacan': 'MI',
    'morelos': 'MO', 'nayarit': 'NA', 'nuevo leon': 'NL', 'oaxaca': 'OA',
    'puebla': 'PU', 'queretaro': 'QE', 'quintana roo': 'QR', 'san luis potosi': 'SL',
    'sinaloa': 'SI', 'sonora': 'SO', 'tabasco': 'TB', 'tamaulipas': 'TM',
    'tlaxcala': 'TL', 'veracruz': 'VE', 'yucatan': 'YU', 'zacatecas': 'ZA'
  }
}

// Extract state/province from address text for countries that require it
function extractStateProvince(addressText, countryCode) {
  if (!addressText || !countryCode || !COUNTRIES_WITH_STATE.includes(countryCode)) {
    return null
  }
  
  const mappings = STATE_PROVINCE_CODES[countryCode]
  if (!mappings) return null
  
  const addressLower = addressText.toLowerCase()
  
  // Try to find state/province in address text
  for (const [key, code] of Object.entries(mappings)) {
    if (addressLower.includes(key)) {
      return code
    }
  }
  
  return null
}

// Validate and normalize postal code format by country
// Covers all 20 automated countries from the CSV
function validatePostalCode(postalCode, countryCode) {
  if (!postalCode || !countryCode) return postalCode || ''
  
  const code = postalCode.trim().toUpperCase()
  
  switch (countryCode) {
    // UK: Format "W1J 9BR" (with space)
    case 'GB':
      if (/^[A-Z]{1,2}\d{1,2}[A-Z]?\d[A-Z]{2}$/.test(code)) {
        return code.replace(/^([A-Z]{1,2}\d{1,2}[A-Z]?)(\d[A-Z]{2})$/, '$1 $2')
      }
      return code
      
    // Canada: Format "K1A 0B1" (with space)
    case 'CA':
      if (/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(code)) {
        return code.replace(/^([A-Z]\d[A-Z])(\d[A-Z]\d)$/, '$1 $2')
      }
      return code
      
    // Netherlands: Format "1012 AB" (4 digits + 2 letters with space)
    case 'NL':
      if (/^\d{4}[A-Z]{2}$/.test(code)) {
        return code.replace(/^(\d{4})([A-Z]{2})$/, '$1 $2')
      }
      return code
      
    // Ireland: Format "D02 AF30" (with space)
    case 'IE':
      if (/^[A-Z]\d{2}[A-Z]{2}\d{2}$/.test(code)) {
        return code.replace(/^([A-Z]\d{2})([A-Z]{2}\d{2})$/, '$1 $2')
      }
      return code
      
    // Sweden: Format "123 45" (5 digits with space)
    case 'SE':
      if (/^\d{5}$/.test(code)) {
        return code.replace(/^(\d{3})(\d{2})$/, '$1 $2')
      }
      return code
      
    // Portugal: Format "1234-567" (7 digits with dash)
    case 'PT':
      if (/^\d{7}$/.test(code)) {
        return code.replace(/^(\d{4})(\d{3})$/, '$1-$2')
      }
      return code
      
    // Australia: 4 digits (no formatting needed, but validate)
    case 'AU':
      if (/^\d{4}$/.test(code)) {
        return code
      }
      return code
      
    // Austria: 4 digits
    case 'AT':
      if (/^\d{4}$/.test(code)) {
        return code
      }
      return code
      
    // Belgium: 4 digits
    case 'BE':
      if (/^\d{4}$/.test(code)) {
        return code
      }
      return code
      
    // Denmark: 4 digits
    case 'DK':
      if (/^\d{4}$/.test(code)) {
        return code
      }
      return code
      
    // Luxembourg: 4 digits
    case 'LU':
      if (/^\d{4}$/.test(code)) {
        return code
      }
      return code
      
    // New Zealand: 4 digits
    case 'NZ':
      if (/^\d{4}$/.test(code)) {
        return code
      }
      return code
      
    // Norway: 4 digits
    case 'NO':
      if (/^\d{4}$/.test(code)) {
        return code
      }
      return code
      
    // Switzerland: 4 digits
    case 'CH':
      if (/^\d{4}$/.test(code)) {
        return code
      }
      return code
      
    // Finland: 5 digits
    case 'FI':
      if (/^\d{5}$/.test(code)) {
        return code
      }
      return code
      
    // France: 5 digits
    case 'FR':
      if (/^\d{5}$/.test(code)) {
        return code
      }
      return code
      
    // Germany: 5 digits
    case 'DE':
      if (/^\d{5}$/.test(code)) {
        return code
      }
      return code
      
    // Italy: 5 digits
    case 'IT':
      if (/^\d{5}$/.test(code)) {
        return code
      }
      return code
      
    // Mexico: 5 digits
    case 'MX':
      if (/^\d{5}$/.test(code)) {
        return code
      }
      return code
      
    // Spain: 5 digits
    case 'ES':
      if (/^\d{5}$/.test(code)) {
        return code
      }
      return code
      
    default:
      return code
  }
}

// Format address for EasyPost based on country requirements
// NOTE: EasyPost allows omitting state field for countries that don't use it
// Only include state for countries that require it (CA, AU, MX, US)
function formatAddressForEasyPost(parsedAddress, countryCode, fullAddressText = '') {
  const country = normalizeCountryCode(countryCode) || ''
  
  // Base address object - do NOT include state by default
  const address = {
    street1: parsedAddress.line1 || '',
    street2: parsedAddress.line2 || '',
    city: parsedAddress.city || '',
    zip: validatePostalCode(parsedAddress.postal_code, country),
    country: country
  }
  
  // Only add state/province for countries that require it
  if (COUNTRIES_WITH_STATE.includes(country)) {
    const state = extractStateProvince(fullAddressText, country)
    if (state) {
      address.state = state
    }
    // If country requires state but we can't extract it, use empty string as fallback
    // This handles edge cases where state is required but not found in address text
    if (!address.state) {
      address.state = ''
    }
  }
  // For other countries (GB, EU, etc.), do NOT include state field at all
  // EasyPost allows omitting the field for countries that don't use states
  
  return address
}

// Disable Vercel's default body parsing to get raw body for Stripe webhooks
export const config = {
  api: {
    bodyParser: false,
  },
}

// Helper function to read raw body from request
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      const buffer = Buffer.concat(chunks)
      resolve(buffer)
    })
    req.on('error', reject)
  })
}

// Use the same Stripe key as other files
const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const stripe = new Stripe(stripeSecretKey)

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  
  console.log(`Webhook request: ${req.method} from origin: ${req.headers.origin}`)
  
  // Enhanced CORS configuration
  const allowedOrigins = [
    'https://fastidp.com',
    'https://www.fastidp.com',
    'http://localhost:3000', // For local development
    'https://localhost:3000'
  ]
  
  const origin = req.headers.origin
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    console.log(`CORS origin allowed: ${origin}`)
  } else {
    console.log(`CORS origin NOT in allowlist: ${origin}`)
    console.log(`Allowed origins:`, allowedOrigins)
    // Default to live domain
    res.setHeader('Access-Control-Allow-Origin', 'https://fastidp.com')
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, stripe-signature')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Max-Age', '86400') // 24 hours
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    console.log('CORS preflight request from:', origin)
    return res.status(200).end()
  }

  // Only allow POST requests for actual webhook calls
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Get raw body for Stripe webhook signature verification
  const rawBody = await getRawBody(req)
  const sig = req.headers['stripe-signature']
  
  let event

  try {
    if (sig) {
      // This is a real Stripe webhook with signature - use raw body buffer
      event = stripe.webhooks.constructEvent(
        rawBody, 
        sig, 
        process.env.STRIPE_WEBHOOK_SECRET
      )
    } else {
      // This is a manual call from frontend (no signature) - parse as JSON
      try {
        event = JSON.parse(rawBody.toString())
      } catch (parseError) {
        console.error('Failed to parse request body as JSON:', parseError.message)
        return res.status(400).json({ error: 'Invalid JSON in request body' })
      }
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return res.status(400).json({ error: `Webhook Error: ${err.message}` })
  }

  // Handle the event
  try {
    
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object)
        break
      
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object)
        break
      
      case 'checkout.session.expired':
        await handleCheckoutExpired(event.data.object)
        break
      
      default:
    }

    res.status(200).json({ received: true, eventType: event.type })
  } catch (error) {
    console.error('=== WEBHOOK HANDLER ERROR ===')
    console.error('Error details:', error)
    console.error('Stack trace:', error.stack)
    
    // Ensure CORS headers are set even in error responses
    res.setHeader('Access-Control-Allow-Origin', 'https://fastidp.com')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    
    res.status(500).json({ error: 'Webhook handler failed', details: error.message })
  }
}

// Handle successful checkout completion
async function handleCheckoutCompleted(session) {
  
  // Update application with payment success using Supabase
  const { data, error } = await supabase
    .from('applications')
    .update({
      payment_status: 'completed',
      stripe_payment_intent_id: session.payment_intent,
      updated_at: new Date().toISOString()
    })
    .eq('stripe_session_id', session.id)
    .select('application_id, form_data, file_urls, fulfillment_type')
    .single()

  if (error) {
    console.error('Database update failed:', error)
    return
  }

  if (data) {
    // For checkout sessions, we don't have detailed address data like PaymentIntents
    // But we can still trigger the automation
    await triggerMakeAutomation(data.application_id, data.form_data, { 
      id: session.payment_intent,
      payment_method: session.payment_method,
      amount: session.amount_total,
      currency: session.currency 
    }, null, data.file_urls, data.fulfillment_type)
    
  } else {
    console.error('No application found for session:', session.id)
  }
}

// Handle payment intent success (for embedded payments)
async function handlePaymentSucceeded(paymentIntentData) {
  
  // If this is a simplified object from frontend, fetch the full PaymentIntent
  let paymentIntent = paymentIntentData
  console.log('=== PAYMENT INTENT DEBUG ===')
  console.log('Initial paymentIntentData:', JSON.stringify(paymentIntentData, null, 2))
  
  if (!paymentIntent.amount || !paymentIntent.payment_method) {
    console.log('Fetching full PaymentIntent from Stripe...')
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentData.id, {
        expand: ['payment_method']
      })
      console.log('Retrieved PaymentIntent metadata:', JSON.stringify(paymentIntent.metadata, null, 2))
    } catch (error) {
      console.error('Failed to retrieve PaymentIntent:', error)
      return
    }
  }
  
  const applicationId = paymentIntent.metadata?.applicationId || paymentIntent.metadata?.application_id
  console.log('Extracted applicationId:', applicationId)
  console.log('=== END PAYMENT INTENT DEBUG ===')
  
  if (!applicationId) {
    console.error('No application ID in payment intent metadata')
    console.error('Available metadata keys:', Object.keys(paymentIntent.metadata || {}))
    return
  }


  // First, let's check if the application exists at all
  const { data: checkData, error: checkError } = await supabase
    .from('applications')
    .select('application_id, payment_status')
    .eq('application_id', applicationId)
    .single()
  

  // Get the payment method to extract address details
  let paymentMethod = null
  let shippingAddress = null
  
  try {
    if (paymentIntent.payment_method) {
      if (typeof paymentIntent.payment_method === 'string') {
        paymentMethod = await stripe.paymentMethods.retrieve(paymentIntent.payment_method)
      } else {
        paymentMethod = paymentIntent.payment_method
      }
    }
    
    // Check if there's shipping information in the payment intent
    if (paymentIntent.shipping) {
      shippingAddress = paymentIntent.shipping.address
    }
  } catch (error) {
    console.error('Failed to retrieve payment method details:', error)
  }

  // Update application with payment success and address data
  const addressData = {
    billing_address: paymentMethod?.billing_details?.address || null,
    billing_name: paymentMethod?.billing_details?.name || null,
    billing_email: paymentMethod?.billing_details?.email || null,
    billing_phone: paymentMethod?.billing_details?.phone || null,
    shipping_address: shippingAddress || null,
    shipping_name: paymentIntent.shipping?.name || null,
    shipping_phone: paymentIntent.shipping?.phone || null,
  }


  const { data, error } = await supabase
    .from('applications')
    .update({
      payment_status: 'completed',
      stripe_payment_intent_id: paymentIntent.id,
      stripe_payment_method_id: paymentIntent.payment_method,
      payment_completed_at: new Date().toISOString(),
      amount_paid: paymentIntent.amount / 100, // Convert cents to dollars
      billing_address: JSON.stringify(addressData.billing_address),
      billing_name: addressData.billing_name,
      billing_email: addressData.billing_email,
      billing_phone: addressData.billing_phone,
      shipping_address: JSON.stringify(addressData.shipping_address),
      shipping_name: addressData.shipping_name,
      shipping_phone: addressData.shipping_phone,
      updated_at: new Date().toISOString()
    })
    .eq('application_id', applicationId)
    .select('application_id, form_data, file_urls, fulfillment_type')
    .single()


  if (error) {
    console.error('Database update failed:', error)
    console.error('Error details:', JSON.stringify(error, null, 2))
    return
  }

  if (data) {
    // Trigger Make.com automation with payment intent and address data
    await triggerMakeAutomation(data.application_id, data.form_data, paymentIntent, addressData, data.file_urls, data.fulfillment_type)
    
  } else {
    console.error('No application found for payment intent:', paymentIntent.id)
  }
}

// Handle expired checkout sessions
async function handleCheckoutExpired(session) {
  
  // Update application status to expired using Supabase
  const { error } = await supabase
    .from('applications')
    .update({
      payment_status: 'expired',
      updated_at: new Date().toISOString()
    })
    .eq('stripe_session_id', session.id)

  if (error) {
    console.error('Failed to mark session as expired:', error)
  } else {
  }
}

// Convert date from YYYY-MM-DD to MM/DD/YYYY format
function convertToMMDDYYYY(dateString) {
  if (!dateString) return dateString
  
  // Check if already in YYYY-MM-DD format
  const isoDateMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoDateMatch) {
    const [, year, month, day] = isoDateMatch
    return `${month}/${day}/${year}`
  }
  
  // Return as-is if not in expected format
  return dateString
}

// Trigger Make.com automation with application data for business workflow
async function triggerMakeAutomation(applicationId, formDataString, paymentIntent, addressData = null, fileData = null, fulfillmentType = null) {
  
  try {
    console.log('=== triggerMakeAutomation called ===')
    console.log('applicationId:', applicationId)
    console.log('paymentIntent:', paymentIntent?.id)
    
    // Parse form data
    const formData = typeof formDataString === 'string' 
      ? JSON.parse(formDataString) 
      : formDataString
    
    console.log('formData parsed successfully')
    console.log('shippingCategory:', formData?.shippingCategory)

    // Parse file URLs (new structure)
    const parsedFileData = fileData ? (typeof fileData === 'string' ? JSON.parse(fileData) : fileData) : null

    // Calculate processing time based on selection
    const getProcessingTime = (option) => {
      switch (option) {
        case 'standard':
          return '3-5 business days'
        case 'fast':
          return '1-2 business days'
        case 'fastest':
          return 'Same-day/Next-day (if received before 12pm ET)'
        default:
          return '3-5 business days'
      }
    }

    // Get delivery details (backend note) based on speed
    const getDeliveryDetails = (speed) => {
      const details = {
        'standard': '3-5 business days processing & standard shipping',
        'fast': '1-2 business days processing & expedited shipping',
        'fastest': 'Same-day processing & overnight shipping'
      }
      return details[speed] || details.standard
    }

    // Get delivery estimate (customer-facing) based on speed and category
    const getDeliveryEstimate = (speed, category) => {
      if (category === 'domestic') {
        if (speed === 'standard') return 'Arrives in 6-8 business days - longer for US Territories'
        if (speed === 'fast') return 'Arrives in 3-4 business days - longer for US Territories'
        if (speed === 'fastest') return 'Arrives the next business day (or in 2 bus. days if application is received after noon ET - longer for US territories'
      } else if (category === 'international') {
        if (speed === 'standard') return 'Arrives in 7-10 business days'
        if (speed === 'fast') return 'Arrives in 4-7 business days'
        if (speed === 'fastest') return 'Processing by noon ET. Arrives in 2-5 business days - contact us for your location\'s shipping timeline'
      } else if (category === 'military') {
        if (speed === 'standard') return 'Arrives in 8-15 business days'
        if (speed === 'fast') return 'Arrives in 6-12 business days'
        if (speed === 'fastest') return 'Arrives in 5-11 business days'
      }
      return 'Delivery estimate unavailable'
    }

    // Calculate shipping speed requirement for EasyPost (in days)
    const getShippingSpeedDays = (option, category) => {
      if (category === 'military') {
        if (option === 'standard') return 15
        if (option === 'fast') return 12
        if (option === 'fastest') return 11
        return 15
      }
      
      if (category === 'international') {
        if (option === 'standard') return 10
        if (option === 'fast') return 7
        if (option === 'fastest') return 5
        return 10
      }
      
      // Domestic
      if (option === 'standard') return 8
      if (option === 'fast') return 4
      if (option === 'fastest') return 2
      return 8
    }

    // Determine carrier based on shipping category
    const getCarrier = (category) => {
      if (category === 'military') {
        return 'USPS' // Only USPS can deliver to military bases
      }
      return null // Let EasyPost choose best carrier for domestic/international
    }

    // Prepare comprehensive data for Make.com business workflow
    console.log('Building automationData object...')
    let automationData
    try {
      automationData = {
      // Application identification
      application_id: applicationId,
      payment_status: 'completed',
      stripe_payment_intent_id: paymentIntent.id,
      amount_total: paymentIntent.amount / 100, // Convert from cents
      currency: paymentIntent.currency,
      
      // Tax information
      tax_details: {
        tax_rate: 0.0775,
        tax_jurisdiction: 'Bellefontaine, OH',
        subtotal: (paymentIntent.amount / 100) / 1.0775, // Calculate pre-tax amount
        tax_amount: (paymentIntent.amount / 100) - ((paymentIntent.amount / 100) / 1.0775)
      },
      
      // Customer personal information (for work order)
      customer: {
        first_name: formData.firstName,
        middle_name: formData.middleName || '',
        last_name: formData.lastName,
        full_name: `${formData.firstName} ${formData.middleName || ''} ${formData.lastName}`.trim(),
        email: formData.email,
        phone: formData.phone,
        date_of_birth: convertToMMDDYYYY(formData.dateOfBirth),
        signature_url: parsedFileData?.signature?.publicUrl || null, // Signature URL from storage
        signature_email_url: parsedFileData?.signature?.publicUrl ? `${parsedFileData.signature.publicUrl}?width=400&height=200&resize=contain&format=png` : null // Optimized for email
      },
    
      // License information
      license_info: {
        license_number: formData.licenseNumber,
        license_state: formData.licenseState,
        license_expiration: formData.licenseExpiration,
        birthplace_city: formData.birthplaceCity,
        birthplace_state: formData.birthplaceState
      },
      
      // Travel information
      travel_info: {
        drive_abroad: formData.driveAbroad,
        departure_date: convertToMMDDYYYY(formData.departureDate),
        permit_effective_date: convertToMMDDYYYY(formData.permitEffectiveDate)
      },
      
      // Form address (step 1)
      form_address: {
        street_address: formData.streetAddress,
        street_address_2: formData.streetAddress2,
        city: formData.city,
        state: formData.state,
        zip_code: formData.zipCode
      },
      
      // Shipping address from Stripe (step 4) or form shipping fields (step 3)
      shipping_address: (() => {
        try {
          // Priority 1: Use Stripe shipping address if available
          if (addressData?.shipping_address) {
            return {
              name: addressData.shipping_name || `${formData.firstName} ${formData.lastName}`,
              phone: addressData.shipping_phone || formData.phone,
              line1: addressData.shipping_address.line1,
              line2: addressData.shipping_address.line2 || '',
              city: addressData.shipping_address.city,
              state: addressData.shipping_address.state,
              postal_code: addressData.shipping_address.postal_code,
              country: normalizeCountryCode(addressData.shipping_address.country) || 'US'
            }
          }
          
        // Priority 2: For international, use international full address
        if (formData.shippingCategory === 'international' && formData.internationalFullAddress) {
          // Use the robust international address parser that handles all countries
          let parsedAddress
          try {
            parsedAddress = parseInternationalAddress(
              formData.internationalFullAddress,
              formData.shippingCountry
            )
          } catch (parseError) {
            console.error('Error parsing international address:', parseError)
            // Fallback to basic parsing
            parsedAddress = {
              line1: formData.internationalFullAddress.split('\n')[0] || '',
              line2: '',
              city: '',
              postal_code: '',
              country: normalizeCountryCode(formData.shippingCountry) || ''
            }
          }
          
          // Format address with country-specific requirements
          const countryCode = parsedAddress.country || normalizeCountryCode(formData.shippingCountry) || ''
          const formattedAddress = formatAddressForEasyPost(
            parsedAddress,
            countryCode,
            formData.internationalFullAddress
          )
          
          // Build shipping_address object (for webhook payload, not EasyPost API)
          // NOTE: shipping_address.state is always included (even if empty) for Make.com static mapping
          // Make.com has a static mapping from shipping_address.state to EasyPost state field
          const shippingAddress = {
            name: formData.recipientName || `${formData.firstName} ${formData.lastName}`,
            phone: formData.recipientPhone || formData.phone,
            line1: formattedAddress.street1 || parsedAddress.line1,
            line2: formattedAddress.street2 || parsedAddress.line2,
            city: formattedAddress.city || parsedAddress.city,
            state: formattedAddress.state !== undefined ? formattedAddress.state : '', // Always include for Make.com mapping
            postal_code: formattedAddress.zip || parsedAddress.postal_code,
            country: formattedAddress.country || parsedAddress.country,
            full_address: formData.internationalFullAddress, // Include full address for reference
            local_address: formData.internationalLocalAddress || null,
            delivery_instructions: formData.internationalDeliveryInstructions || null
          }
          
          return shippingAddress
        }
          
          // Priority 3: Use step 3 shipping address fields (for domestic/military)
          if (formData.shippingStreetAddress) {
            return {
              name: formData.recipientName || `${formData.firstName} ${formData.lastName}`,
              phone: formData.recipientPhone || formData.shippingPhone || formData.phone,
              line1: formData.shippingStreetAddress,
              line2: formData.shippingStreetAddress2 || '',
              city: formData.shippingCity,
              state: formData.shippingState,
              postal_code: formData.shippingPostalCode,
              country: normalizeCountryCode(formData.shippingCountry) || 'US',
              delivery_instructions: formData.shippingDeliveryInstructions || null
            }
          }
          
          // Priority 4: Fallback to form address (step 1)
          return {
            name: `${formData.firstName} ${formData.lastName}`,
            phone: formData.phone,
            line1: formData.streetAddress,
            line2: formData.streetAddress2 || '',
            city: formData.city,
            state: formData.state,
            postal_code: formData.zipCode,
            country: 'US'
          }
        } catch (error) {
          console.error('Error constructing shipping_address:', error)
          // Return a safe fallback
          return {
            name: `${formData.firstName} ${formData.lastName}`,
            phone: formData.phone || '',
            line1: formData.streetAddress || '',
            line2: formData.streetAddress2 || '',
            city: formData.city || '',
            state: formData.state || '',
            postal_code: formData.zipCode || '',
            country: 'US'
          }
        }
      })(),
      
      // Application selections
      selections: {
        license_types: formData.licenseTypes || [],
        selected_permits: formData.selectedPermits || [],
        delivery_speed: formData.processingOption, // 'standard', 'fast', or 'fastest'
        shipping_category: formData.shippingCategory, // 'domestic', 'international', or 'military'
        delivery_details: getDeliveryDetails(formData.processingOption), // Backend processing note
        estimated_delivery: getDeliveryEstimate(formData.processingOption, formData.shippingCategory), // Customer delivery estimate
        processing_time_estimate: getProcessingTime(formData.processingOption) // Legacy field for compatibility
      },
      
      // Fulfillment type (automated vs manual)
      fulfillment_type: fulfillmentType || 'manual',
      
      // Step 3 shipping address fields (for domestic/military - separate from Stripe address)
      shipping_address_form_fields: (formData.shippingCategory !== 'international' && formData.shippingStreetAddress) ? {
        recipient_name: formData.recipientName || `${formData.firstName} ${formData.lastName}`,
        recipient_phone: formData.recipientPhone || formData.shippingPhone || formData.phone,
        street_address: formData.shippingStreetAddress,
        street_address_2: formData.shippingStreetAddress2 || '',
        city: formData.shippingCity,
        state: formData.shippingState,
        postal_code: formData.shippingPostalCode,
        country: normalizeCountryCode(formData.shippingCountry) || 'US',
        delivery_instructions: formData.shippingDeliveryInstructions || null
      } : null,
      
      // International shipping details (when applicable)
      international_shipping: formData.shippingCategory === 'international' ? {
        country: normalizeCountryCode(formData.shippingCountry) || null,
        pccc_code: formData.pcccCode || null,
        recipient_name: formData.recipientName,
        recipient_phone: formData.recipientPhone,
        full_address: formData.internationalFullAddress,
        local_address: formData.internationalLocalAddress || null,
        delivery_instructions: formData.internationalDeliveryInstructions || null
      } : null,
      
      // Customer uploaded files (URLs from Supabase Storage)
      customer_files: {
        id_document_urls: parsedFileData?.driversLicense?.map(file => ({
          url: file.publicUrl,
          fileName: file.fileName,
          originalName: file.originalName,
          // Add image transformation parameters for email attachments
          emailUrl: `${file.publicUrl}?width=800&height=600&resize=contain&format=webp`,
          thumbnailUrl: `${file.publicUrl}?width=200&height=200&resize=cover&format=webp`
        })) || [],
        passport_photo_urls: parsedFileData?.passportPhoto?.map(file => ({
          url: file.publicUrl,
          fileName: file.fileName,
          originalName: file.originalName,
          // Add image transformation parameters for email attachments
          emailUrl: `${file.publicUrl}?width=800&height=600&resize=contain&format=webp`,
          thumbnailUrl: `${file.publicUrl}?width=200&height=200&resize=cover&format=webp`
        })) || [],
        
        // Flattened fields for Make.com (just the first 5)
        id_document_url_1: parsedFileData?.driversLicense?.[0]?.publicUrl || null,
        id_document_url_2: parsedFileData?.driversLicense?.[1]?.publicUrl || null,
        id_document_url_3: parsedFileData?.driversLicense?.[2]?.publicUrl || null,
        id_document_url_4: parsedFileData?.driversLicense?.[3]?.publicUrl || null,
        id_document_url_5: parsedFileData?.driversLicense?.[4]?.publicUrl || null,
        
        passport_photo_url_1: parsedFileData?.passportPhoto?.[0]?.publicUrl || null,
        passport_photo_url_2: parsedFileData?.passportPhoto?.[1]?.publicUrl || null,
        passport_photo_url_3: parsedFileData?.passportPhoto?.[2]?.publicUrl || null,
        passport_photo_url_4: parsedFileData?.passportPhoto?.[3]?.publicUrl || null,
        passport_photo_url_5: parsedFileData?.passportPhoto?.[4]?.publicUrl || null,
        
        // Legacy fields for backward compatibility (first file URLs)
        id_document_url: parsedFileData?.driversLicense?.[0]?.publicUrl || null,
        passport_photo_url: parsedFileData?.passportPhoto?.[0]?.publicUrl || null,
        signature_url: parsedFileData?.signature?.publicUrl || null,
        // Signature with transformation for email
        signature_email_url: parsedFileData?.signature?.publicUrl ? `${parsedFileData.signature.publicUrl}?width=400&height=200&resize=contain&format=png` : null,
        // File naming convention for Make.com to use
        id_document_filename: `${formData.firstName}${formData.lastName}_ID_Document.jpg`,
        passport_photo_filename: `${formData.firstName}${formData.lastName}_Passport_Photo.jpg`,
        signature_filename: `${formData.firstName}${formData.lastName}_Signature.png`
      },
      
      // EasyPost shipping data (for Create a Shipment step in Make.com)
      // 
      // MAPPING INSTRUCTIONS FOR MAKE.COM:
      // In Make.com's EasyPost "Create a Shipment" module, map these fields:
      // 
      // FROM ADDRESS:
      //   - Name: easypost_shipment.from_address.name
      //   - Company: easypost_shipment.from_address.company
      //   - Street 1: easypost_shipment.from_address.street1
      //   - Street 2: easypost_shipment.from_address.street2
      //   - City: easypost_shipment.from_address.city
      //   - State: easypost_shipment.from_address.state
      //   - ZIP: easypost_shipment.from_address.zip
      //   - Country: easypost_shipment.from_address.country
      //   - Phone: easypost_shipment.from_address.phone
      //   - Email: easypost_shipment.from_address.email
      //
      // TO ADDRESS:
      //   - Name: easypost_shipment.to_address.name
      //   - Street 1: easypost_shipment.to_address.street1
      //   - Street 2: easypost_shipment.to_address.street2
      //   - City: easypost_shipment.to_address.city
      //   - State: easypost_shipment.to_address.state
      //     * IMPORTANT: State field is ONLY included for countries that require it
      //     * For CA, AU, MX, US: Contains actual state/province code (e.g., "ON", "NSW", "BC", "OH")
      //     * For all other countries (GB, EU, etc.): Field is OMITTED (EasyPost allows omitting for countries without states)
      //     * In Make.com EasyPost module: Use easypost_shipment.to_address.state (not shipping_address.state)
      //     * For countries without states, this field will be undefined - EasyPost accepts this
      //   - ZIP: easypost_shipment.to_address.zip (validated and normalized per country)
      //   - Country: easypost_shipment.to_address.country (already normalized 2-char code)
      //   - Phone: easypost_shipment.to_address.phone
      //   - Email: easypost_shipment.to_address.email
      //
      // PARCEL:
      //   - Length: easypost_shipment.parcel.length (inches)
      //   - Width: easypost_shipment.parcel.width (inches)
      //   - Height: easypost_shipment.parcel.height (inches)
      //   - Weight: easypost_shipment.parcel.weight (ounces)
      //
      // CUSTOMS INFO (REQUIRED for international shipments):
      //   - Only included when shippingCategory === 'international'
      //   - Two approaches supported:
      //   
      //   APPROACH 1: Nested in shipment (if Make.com "Create a Shipment" supports it):
      //     - customs_info: easypost_shipment.customs_info (complete object with all fields)
      //     - This includes: contents_type, contents_explanation, customs_certify, customs_signer,
      //       restriction_type, restriction_comments, non_delivery_option, eel_pfc, customs_items
      //   
      //   APPROACH 2: Separate modules (recommended per Make.com workflow):
      //     - customs_items: Top-level array for "Create CustomsItem" loop module
      //       * Loop through: automationData.customs_items
      //       * Each item has: description, quantity, value, weight, hs_tariff_number, origin_country
      //     - customs_info_metadata: Top-level object for "Create CustomsInfo" module
      //       * Map fields: contents_type, contents_explanation, customs_certify, customs_signer,
      //         restriction_type, restriction_comments, non_delivery_option, eel_pfc
      //     - Then reference the created CustomsInfo ID when creating the shipment
      //   
      //   - For domestic/military: customs_info, customs_items, and customs_info_metadata are all null
      //
      // OPTIONAL FIELDS:
      //   - Carrier: easypost_shipment.carrier (if specified, e.g., "USPS" for military)
      //   - Options: easypost_shipment.options (label format, size, etc.)
      //
      easypost_shipment: {
        // From address (business/shipping origin)
        // TODO: Update with actual business address
        from_address: {
          name: 'FastIDP',
          company: 'FastIDP',
          street1: process.env.BUSINESS_STREET_ADDRESS || '123 Main Street',
          street2: process.env.BUSINESS_STREET_ADDRESS_2 || '',
          city: process.env.BUSINESS_CITY || 'Bellefontaine',
          state: process.env.BUSINESS_STATE || 'OH',
          zip: process.env.BUSINESS_ZIP || '43311',
          country: 'US',
          phone: process.env.BUSINESS_PHONE || '',
          email: process.env.BUSINESS_EMAIL || 'support@fastidp.com'
        },
        // To address (customer/recipient)
        to_address: (() => {
          try {
            // Priority 1: Use Stripe shipping address if available
            if (addressData?.shipping_address) {
              return {
                name: addressData.shipping_name || `${formData.firstName} ${formData.lastName}`,
                street1: addressData.shipping_address.line1,
                street2: addressData.shipping_address.line2 || '',
                city: addressData.shipping_address.city,
                state: addressData.shipping_address.state || '', // Ensure state is always present
                zip: addressData.shipping_address.postal_code,
                country: normalizeCountryCode(addressData.shipping_address.country) || 'US',
                phone: addressData.shipping_phone || formData.phone,
                email: formData.email
              }
            }
            
            // Priority 2: Use step 3 shipping address fields (for domestic/military)
            if (formData.shippingStreetAddress) {
              return {
                name: formData.recipientName || `${formData.firstName} ${formData.lastName}`,
                street1: formData.shippingStreetAddress,
                street2: formData.shippingStreetAddress2 || '',
                city: formData.shippingCity,
                state: formData.shippingState || '', // Ensure state is always present
                zip: formData.shippingPostalCode,
                country: normalizeCountryCode(formData.shippingCountry) || 'US',
                phone: formData.recipientPhone || formData.shippingPhone || formData.phone,
                email: formData.email
              }
            }
            
            // Priority 3: Use international full address (for international)
            if (formData.shippingCategory === 'international' && formData.internationalFullAddress) {
              // Use the robust international address parser that handles all countries
              let parsedAddress
              try {
                parsedAddress = parseInternationalAddress(
                  formData.internationalFullAddress,
                  formData.shippingCountry
                )
              } catch (parseError) {
                console.error('Error parsing international address for EasyPost:', parseError)
                // Fallback to basic parsing
                parsedAddress = {
                  line1: formData.internationalFullAddress.split('\n')[0] || '',
                  line2: '',
                  city: '',
                  postal_code: '',
                  country: normalizeCountryCode(formData.shippingCountry) || ''
                }
              }
              
              // Format address for EasyPost with country-specific requirements
              const countryCode = parsedAddress.country || normalizeCountryCode(formData.shippingCountry) || ''
              const formattedAddress = formatAddressForEasyPost(
                parsedAddress,
                countryCode,
                formData.internationalFullAddress
              )
              
              // Validate required fields are not empty
              if (!formattedAddress.street1 || !formattedAddress.city || !formattedAddress.zip) {
                console.warn('Incomplete address parsed, using full address as street1:', {
                  street1: formattedAddress.street1,
                  city: formattedAddress.city,
                  zip: formattedAddress.zip
                })
                // Fallback: use full address as street1 if parsing failed
                formattedAddress.street1 = formattedAddress.street1 || formData.internationalFullAddress.split('\n')[0] || ''
                formattedAddress.city = formattedAddress.city || 'Unknown'
                formattedAddress.zip = formattedAddress.zip || ''
              }
              
              // Build address object - only include state if it exists (for CA, AU, MX, US)
              const addressObj = {
                name: formData.recipientName || `${formData.firstName} ${formData.lastName}`,
                street1: formattedAddress.street1,
                street2: formattedAddress.street2,
                city: formattedAddress.city,
                zip: formattedAddress.zip,
                country: formattedAddress.country,
                phone: formData.recipientPhone || formData.phone,
                email: formData.email
              }
              
              // Only include state if it exists (countries that require it)
              if (formattedAddress.state !== undefined) {
                addressObj.state = formattedAddress.state
              }
              // For countries without states (GB, EU, etc.), omit state field entirely
              
              return addressObj
            }
            
            // Priority 4: Fallback to form address (step 1)
            return {
              name: `${formData.firstName} ${formData.lastName}`,
              street1: formData.streetAddress,
              street2: formData.streetAddress2 || '',
              city: formData.city,
              state: formData.state || '', // Ensure state is always present (empty string if missing)
              zip: formData.zipCode,
              country: 'US',
              phone: formData.phone,
              email: formData.email
            }
          } catch (error) {
            console.error('Error constructing easypost_shipment.to_address:', error)
            // Return a safe fallback - always include state field
            return {
              name: `${formData.firstName} ${formData.lastName}`,
              street1: formData.streetAddress || '',
              street2: formData.streetAddress2 || '',
              city: formData.city || '',
              state: formData.state || '', // Always include state (empty string if missing)
              zip: formData.zipCode || '',
              country: 'US',
              phone: formData.phone || '',
              email: formData.email || ''
            }
          }
        })(),
        parcel: {
          length: 9.5,    // Letter envelope size (inches)
          width: 12.5,
          height: 0.1,
          weight: 2     // 2 oz for IDP document
        },
        // Customs information (REQUIRED for international shipments)
        // Only include for international shipping category
        customs_info: formData.shippingCategory === 'international' ? {
          contents_type: 'documents', // IDP is a document
          contents_explanation: 'International Driving Permit (IDP) document',
          customs_certify: true,
          customs_signer: 'FastIDP',
          restriction_type: 'none',
          restriction_comments: '',
          non_delivery_option: 'return',
          eel_pfc: 'NOEEI 30.37(a)', // Low-value shipment exemption for documents
          customs_items: [
            {
              description: 'International Driving Permit',
              quantity: 1,
              value: 0.01, // Minimal value for customs (documents have low/no commercial value)
              weight: 2, // Weight in ounces
              hs_tariff_number: '49019900', // HS code for printed documents
              origin_country: 'US'
            }
          ]
        } : null,
        // Speed requirement for EasyPost to filter rates
        max_delivery_days: getShippingSpeedDays(formData.processingOption, formData.shippingCategory),
        // Carrier specification (USPS required for military)
        carrier: getCarrier(formData.shippingCategory),
        options: {
          label_format: 'PDF',
          label_size: '4x6'
        }
      },
      
      // Customs items array (for Make.com "Create CustomsItem" loop workflow)
      // This is provided separately to support Make.com's workflow where customs items
      // are created in a loop before attaching to the shipment
      // Only included for international shipping category
      customs_items: formData.shippingCategory === 'international' ? [
        {
          description: 'International Driving Permit',
          quantity: 1,
          value: 0.01, // Minimal value for customs (documents have low/no commercial value)
          weight: 8, // Weight in ounces
          hs_tariff_number: '49019900', // HS code for printed documents
          origin_country: 'US'
        }
      ] : null,
      
      // Customs info metadata (for Make.com "Create CustomsInfo" step)
      // These fields are used when creating the CustomsInfo object in Make.com
      // Only included for international shipping category
      customs_info_metadata: formData.shippingCategory === 'international' ? {
        contents_type: 'documents', // IDP is a document
        contents_explanation: 'International Driving Permit (IDP) document',
        customs_certify: true,
        customs_signer: 'FastIDP',
        restriction_type: 'none',
        restriction_comments: '',
        non_delivery_option: 'return',
        eel_pfc: 'NOEEI 30.37(a)' // Low-value shipment exemption for documents
      } : null,
      
      // Business workflow settings
      business_settings: {
        work_order_recipient: 'wilke.gabe1@gmail.com',
        customer_thank_you_email: true,
        store_pdfs_in_supabase: true,
        processing_time_message: getProcessingTime(formData.processingOption)
      },
      
      // Date submitted (formatted for PandaDoc)
      date_submit: convertToMMDDYYYY(new Date().toISOString().split('T')[0]),
      
      // Timestamps
      timestamps: {
        created_at: new Date().toISOString(),
        payment_completed_at: new Date().toISOString()
      }
    }
    } catch (buildError) {
      console.error('=== ERROR BUILDING automationData OBJECT ===')
      console.error('Error:', buildError)
      console.error('Stack:', buildError.stack)
      // Create a minimal fallback object to prevent complete failure
      automationData = {
        application_id: applicationId,
        payment_status: 'completed',
        stripe_payment_intent_id: paymentIntent?.id || 'unknown',
        amount_total: paymentIntent?.amount ? paymentIntent.amount / 100 : 0,
        currency: paymentIntent?.currency || 'usd',
        error: 'Failed to build full automation data',
        error_message: buildError.message
      }
    }

    // Send to Make.com webhook (permanent URL)
    const makeWebhookUrl = 'https://hook.us2.make.com/ug16tj9ocleg8u1vz2qdltztx779wf4b'
    
    console.log('automationData object built successfully')
    console.log('automationData keys:', Object.keys(automationData))
    console.log('Sending to Make.com webhook...')
    
    if (makeWebhookUrl) {
      const payload = JSON.stringify(automationData)
      console.log('Payload size:', payload.length, 'bytes')
      console.log('Payload preview (first 500 chars):', payload.substring(0, 500))
      
      const response = await fetch(makeWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: payload
      })
      
      console.log('Make.com webhook response status:', response.status)
      
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Make.com webhook failed:', response.status, errorText)
        throw new Error(`Make.com webhook failed: ${response.status} ${errorText}`)
      }
      
      const responseText = await response.text()
      
      
      // Update database to track automation trigger
      await supabase
        .from('applications')
        .update({
          make_automation_triggered_at: new Date().toISOString(),
          make_automation_status: 'processing'
        })
        .eq('application_id', applicationId)
        
    } else {
    }

  } catch (error) {
    console.error('=== FAILED TO TRIGGER MAKE.COM BUSINESS WORKFLOW ===')
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    console.error('applicationId:', applicationId)
    console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
    
    // Update database with error status
    try {
      const { error: dbError } = await supabase
        .from('applications')
        .update({
          make_automation_status: 'failed',
          make_automation_error: error.message
        })
        .eq('application_id', applicationId)
      
      if (dbError) {
        console.error('Failed to update automation status:', dbError)
      }
    } catch (dbUpdateError) {
      console.error('Failed to update automation status:', dbUpdateError)
    }
    
    // Re-throw the error so it can be handled upstream
    throw error
  }
}
