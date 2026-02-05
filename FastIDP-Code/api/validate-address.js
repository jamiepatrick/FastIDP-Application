import EasyPost from '@easypost/api'

const easypost = new EasyPost(process.env.EASYPOST_API_KEY)

// Helper function to detect obvious ZIP code mismatches
function checkZipCodeMismatch(state, zip, city) {
  // More specific city/ZIP validation for major cities
  const cityZipRanges = {
    'Dallas': {
      'TX': ['75201', '75212', '75214', '75215', '75216', '75217', '75218', '75219', '75220', '75221', '75223', '75224', '75225', '75226', '75227', '75228', '75229', '75230', '75231', '75232', '75233', '75234', '75235', '75236', '75237', '75238', '75240', '75241', '75243', '75244', '75246', '75247', '75248', '75249', '75250', '75251', '75252', '75253', '75254', '75270', '75275', '75277', '75283', '75284', '75285', '75286', '75287', '75295']
    }
  }
  
  const zipNum = zip.substring(0, 5)
  
  // Check specific city ZIP codes if available
  if (cityZipRanges[city] && cityZipRanges[city][state]) {
    return !cityZipRanges[city][state].includes(zipNum)
  }
  
  // Fallback to broader state validation for other areas
  const stateZipRanges = {
    'TX': [73301, 88595], // Texas ZIP range
    'OK': [73001, 74966], // Oklahoma ZIP range  
    'CA': [90001, 96162], // California ZIP range
    'NY': [10001, 14925], // New York ZIP range
    'FL': [32003, 34997]  // Florida ZIP range
  }
  
  if (!stateZipRanges[state]) return false // Don't validate unknown states
  
  const zipNumInt = parseInt(zipNum)
  const [min, max] = stateZipRanges[state]
  
  return zipNumInt < min || zipNumInt > max
}

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
    // Default to live domain
    res.setHeader('Access-Control-Allow-Origin', 'https://fastidp.com')
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Max-Age', '86400')

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const { street1, street2, city, state, zip, country } = req.body

    // Validate required fields
    if (!street1 || !city || !state || !zip) {
      res.status(400).json({ 
        error: 'Missing required fields: street1, city, state, zip' 
      })
      return
    }

    // Create address object for EasyPost with verification
    // NOTE: We don't send street2 (apartment) to EasyPost because:
    // 1. EasyPost can't reliably validate apartment numbers
    // 2. It may incorrectly suggest apartments that don't exist
    // 3. We only want to validate the base address (street, city, state, ZIP)
    const addressData = {
      street1,
      // street2: intentionally omitted - don't validate apartments
      city,
      state,
      zip,
      country: country || 'US',
      verify: true // Enable EasyPost's verification
    }

    // Verify address with EasyPost
    const address = await easypost.Address.create(addressData)
    
    
    // Check delivery verification results
    const deliveryVerification = address.verifications?.delivery
    const zip4Verification = address.verifications?.zip4
    
    // EasyPost's delivery verification is the authoritative source
    const isDeliverable = deliveryVerification?.success === true
    
    // Check if EasyPost made any standardizations/corrections to base address only
    const wasStandardized = address.street1 !== addressData.street1 ||
                           address.city !== addressData.city ||
                           address.state !== addressData.state ||
                           address.zip !== addressData.zip
    
    // Additional validation: Check for obvious ZIP code mismatches as backup
    const zipMismatch = !isDeliverable && checkZipCodeMismatch(address.state, address.zip, address.city)
    
    const response = {
      deliverable: isDeliverable,
      verifiedAddress: {
        street1: address.street1,
        street2: street2 || '', // Use original apartment input, not EasyPost's response
        city: address.city,
        state: address.state,
        zip: address.zip,
        country: address.country
      },
      suggestions: [],
      errors: deliveryVerification?.errors || [],
      zipMismatch: zipMismatch,
      verificationDetails: {
        deliverySuccess: deliveryVerification?.success || false,
        zip4Success: zip4Verification?.success || false,
        mode: address.mode
      }
    }

    // Only suggest if EasyPost made actual corrections to the base address
    if (wasStandardized && isDeliverable) {
      response.suggestions.push({
        street1: address.street1,
        street2: street2 || '', // Preserve original apartment input, don't let EasyPost change it
        city: address.city,
        state: address.state,
        zip: address.zip,
        country: address.country
      })
    }    res.status(200).json(response)

  } catch (error) {
    console.error('EasyPost validation error:', error)
    
    // Ensure CORS headers are set even in error responses
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
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Max-Age', '86400')
    
    // Handle rate limiting specifically
    if (error.message && error.message.includes('rate-limited')) {
      res.status(429).json({ 
        error: 'Rate limit exceeded',
        details: 'Your EasyPost account has been rate-limited. Please try again later or contact EasyPost support.'
      })
      return
    }
    
    // Handle other API errors
    if (error.message && error.message.includes('INVALID_PARAMETER')) {
      res.status(400).json({ 
        error: 'Invalid address format',
        details: 'Please check your address and try again.'
      })
      return
    }
    
    res.status(500).json({ 
      error: 'Address validation failed',
      details: error.message 
    })
  }
}
