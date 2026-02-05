import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PERMIT_PRICES, getCombinedPrice, getSpeedDisplayName, STRIPE_PRODUCTS } from '../config/pricing.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Helper function to convert base64 to file buffer
function base64ToBuffer(base64String) {
  // Remove the data URL prefix if present (e.g., "data:image/jpeg;base64,")
  const base64Data = base64String.split(',')[1] || base64String
  return Buffer.from(base64Data, 'base64')
}

// Helper function to upload file to Supabase Storage
async function uploadFileToStorage(fileBuffer, fileName, contentType, bucket = 'application-files') {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, fileBuffer, {
        contentType: contentType,
        upsert: true // Replace if file already exists
      })

    if (error) {
      console.error('Storage upload error:', error)
      throw error
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName)

    return {
      path: data.path,
      publicUrl: urlData.publicUrl
    }
  } catch (error) {
    console.error('Error uploading file:', error)
    throw error
  }
}

// Helper function to calculate ship-by date based on processing option
function calculateShipByDate(processingOption, submittedDate = new Date()) {
  const date = new Date(submittedDate)
  let daysToAdd = 5 // Default: standard processing
  
  switch (processingOption) {
    case 'fastest':
      daysToAdd = 1 // Same-day/next-day
      break
    case 'fast':
      daysToAdd = 2 // 1-2 business days
      break
    case 'standard':
    default:
      daysToAdd = 5 // 3-5 business days
      break
  }
  
  // Add business days (skip weekends)
  let addedDays = 0
  while (addedDays < daysToAdd) {
    date.setDate(date.getDate() + 1)
    // Skip weekends (Saturday = 6, Sunday = 0)
    if (date.getDay() !== 0 && date.getDay() !== 6) {
      addedDays++
    }
  }
  
  return date.toISOString().split('T')[0] // Return YYYY-MM-DD
}

// Helper function to process and upload multiple files
async function uploadFilesToStorage(files, applicationId, fileType) {
  const uploadedFiles = []
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    
    // Check if file already has publicUrl (uploaded from frontend)
    if (file.publicUrl && file.path) {
      // File was already uploaded directly to Supabase from frontend
      uploadedFiles.push({
        originalName: file.name,
        fileName: file.path,
        path: file.path,
        publicUrl: file.publicUrl,
        size: file.size,
        type: file.type
      })
      continue
    }
    
    // Legacy support: Handle base64 uploads (if any old clients still use this)
    let extension = 'jpg' // default
    let contentType = file.type || 'image/jpeg'
    
    if (file.data && file.data.includes('data:image/')) {
      const mimeType = file.data.split(';')[0].split(':')[1]
      extension = mimeType.split('/')[1]
    } else if (file.type) {
      extension = file.type.split('/')[1]
    }
    
    // For HEIC files, keep original format
    if (file.name && (file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif'))) {
      extension = 'heic'
      contentType = 'image/heic'
    }
    
    // Create unique filename
    const fileName = `${applicationId}/${fileType}_${i + 1}.${extension}`
    
    // Convert base64 to buffer
    const fileBuffer = base64ToBuffer(file.data)
    
    // Upload to storage
    const uploadResult = await uploadFileToStorage(
      fileBuffer, 
      fileName, 
      contentType
    )
    
    uploadedFiles.push({
      originalName: file.name,
      fileName: fileName,
      path: uploadResult.path,
      publicUrl: uploadResult.publicUrl,
      size: file.size,
      type: file.type
    })
  }
  
  return uploadedFiles
}

// Stripe product mapping imported from config/pricing.js

// Country name to code mapping for parsing international addresses (used by CSV and address parsing)
const COUNTRY_NAME_TO_CODE = {
  // Automated countries - full names to codes
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
  
  // Common variations
  'usa': 'US',
  'united states': 'US',
  'united states of america': 'US',
  'america': 'US',
}

// Load automated country codes from data/countries-automation.csv (source of truth)
const FALLBACK_AUTOMATED_COUNTRIES = ['AU', 'AT', 'BE', 'CA', 'DK', 'FI', 'FR', 'DE', 'IE', 'IT', 'LU', 'MX', 'NL', 'NZ', 'NO', 'PT', 'ES', 'SE', 'CH', 'GB']

function getAutomatedCountryCodes() {
  try {
    const csvPath = path.join(__dirname, '..', 'data', 'countries-automation.csv')
    const raw = readFileSync(csvPath, 'utf-8')
    const lines = raw.split(/\r?\n/).filter(line => line.trim())
    const codes = []
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      const parts = line.split(',')
      const yesCol = (parts.pop() || '').trim().toLowerCase()
      const countryName = parts.join(',').trim().replace(/^"|"$/g, '')
      if (yesCol !== 'yes') continue
      const code = COUNTRY_NAME_TO_CODE[countryName.toLowerCase()]
      if (code) codes.push(code)
    }
    return codes.length > 0 ? codes : FALLBACK_AUTOMATED_COUNTRIES
  } catch (err) {
    console.warn('Could not load countries-automation.csv, using fallback list:', err.message)
    return FALLBACK_AUTOMATED_COUNTRIES
  }
}

const AUTOMATED_COUNTRIES = getAutomatedCountryCodes()

// Helper function to extract country from international address
function extractCountryFromAddress(internationalFullAddress) {
  if (!internationalFullAddress || typeof internationalFullAddress !== 'string') {
    return null
  }
  
  // Split address into lines and get the last non-empty line (usually the country)
  const lines = internationalFullAddress.trim().split('\n').map(line => line.trim()).filter(line => line.length > 0)
  
  if (lines.length === 0) {
    return null
  }
  
  // Check the last line first (most common format)
  const lastLine = lines[lines.length - 1].toLowerCase().trim()
  
  // First, check if it's already a country code (2 letters)
  if (lastLine.length === 2 && /^[a-z]{2}$/.test(lastLine)) {
    return lastLine.toUpperCase()
  }
  
  // Check if the last line matches a known country name
  if (COUNTRY_NAME_TO_CODE[lastLine]) {
    return COUNTRY_NAME_TO_CODE[lastLine]
  }
  
  // If last line doesn't match, search through all lines for country mentions
  for (const line of lines.reverse()) { // Start from last line and work backwards
    const lineLower = line.toLowerCase().trim()
    
    // Check for exact country name matches
    for (const [countryName, countryCode] of Object.entries(COUNTRY_NAME_TO_CODE)) {
      if (lineLower === countryName || lineLower.includes(countryName)) {
        return countryCode
      }
    }
    
    // Check for country code (case insensitive)
    const possibleCode = line.trim().toUpperCase()
    if (possibleCode.length === 2 && /^[A-Z]{2}$/.test(possibleCode)) {
      return possibleCode
    }
  }
  
  console.log('Could not extract country from address:', internationalFullAddress)
  return null
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
  
  // Try to find partial match (handles variations like "United Kingdom" → "united kingdom")
  for (const [countryName, countryCode] of Object.entries(COUNTRY_NAME_TO_CODE)) {
    // Check if input contains the country name or vice versa
    if (countryLower.includes(countryName) || countryName.includes(countryLower)) {
      console.log(`Normalized country: "${country}" → "${countryCode}" (matched: "${countryName}")`)
      return countryCode
    }
  }
  
  // Additional common country name variations not in the main mapping
  const additionalMappings = {
    'britain': 'GB',
    'british': 'GB',
    'u.k.': 'GB',
    'u.k': 'GB',
    'united states': 'US',
    'u.s.': 'US',
    'u.s': 'US',
    'u.s.a.': 'US',
    'u.s.a': 'US',
    'usa': 'US',
  }
  
  if (additionalMappings[countryLower]) {
    console.log(`Normalized country: "${country}" → "${additionalMappings[countryLower]}"`)
    return additionalMappings[countryLower]
  }
  
  // If we can't match, log and return null (will be stored as null in DB)
  console.warn('Could not normalize country code:', country, '- storing as null')
  return null
}

// Helper function to determine fulfillment type based on shipping country
function determineFulfillmentType(shippingCategory, shippingCountry, internationalFullAddress = null) {
  // Domestic and military shipments are always automated
  if (shippingCategory === 'domestic' || shippingCategory === 'military') {
    return 'automated'
  }
  
  // For international shipments, check if country is in automated list
  if (shippingCategory === 'international') {
    let countryCode = shippingCountry
    
    // If no explicit shipping country provided, try to extract from international address
    if (!countryCode && internationalFullAddress) {
      countryCode = extractCountryFromAddress(internationalFullAddress)
      console.log('Extracted country from address:', {
        address: internationalFullAddress,
        extractedCountry: countryCode
      })
    }
    
    if (!countryCode) {
      console.log('No country found for international shipment, defaulting to manual')
      // If no country provided, default to manual for safety
      return 'manual'
    }
    
    // Normalize country code before checking automated list
    // This handles cases where full country names are provided (e.g., "United Kingdom" → "GB")
    const normalizedCountryCode = normalizeCountryCode(countryCode)
    
    if (!normalizedCountryCode) {
      console.log('Could not normalize country code, defaulting to manual:', countryCode)
      return 'manual'
    }
    
    // Check if normalized country code is in automated list
    const isAutomated = AUTOMATED_COUNTRIES.includes(normalizedCountryCode)
    console.log('Country automation check:', {
      originalCountry: countryCode,
      normalizedCountryCode: normalizedCountryCode,
      isAutomated,
      automatedCountries: AUTOMATED_COUNTRIES
    })
    
    return isAutomated ? 'automated' : 'manual'
  }
  
  // Default to manual if category is unknown
  return 'manual'
}

export default async function handler(req, res) {
  // More comprehensive CORS setup to handle various browser behaviors
  const origin = req.headers.origin
  const allowedOrigins = [
    'https://fastidp.com',
    'https://www.fastidp.com',
    'https://framer.app',
    'https://preview.framer.app'
  ]
  
  // Set CORS headers first, before any other processing
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://fastidp.com')
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, User-Agent')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Max-Age', '86400')
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type')
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { applicationId, formData, fileData } = req.body

    // Validate required form data
    if (!formData) {
      return res.status(400).json({ error: 'Form data is required' })
    }
    
    // Validate application ID
    if (!applicationId) {
      return res.status(400).json({ error: 'Application ID is required' })
    }

    // Debug: Check what we're receiving
    console.log('=== SAVE APPLICATION DEBUG ===')
    console.log('All formData keys:', Object.keys(formData))
    console.log('Full formData:', JSON.stringify(formData, null, 2))
    console.log('International fields check:', {
      internationalFullAddress: formData.internationalFullAddress,
      internationalLocalAddress: formData.internationalLocalAddress, 
      internationalDeliveryInstructions: formData.internationalDeliveryInstructions
    })
    console.log('=== END DEBUG ===')

    // Validate required fields (temporarily skip shipping for debugging)
    const requiredFields = ['email', 'firstName', 'lastName', 'selectedPermits', 'processingOption']
    for (const field of requiredFields) {
      const value = formData[field]
      
      if (!value || value === '' || (Array.isArray(value) && value.length === 0)) {
        return res.status(400).json({ 
          error: `${field} is required`,
          received: value,
          type: typeof value
        })
      }
    }

    // Validate file uploads
    if (!fileData || !fileData.driversLicense || !fileData.passportPhoto) {
      return res.status(400).json({ error: 'Both driver\'s license and passport photo uploads are required' })
    }

    if (fileData.driversLicense.length === 0 || fileData.passportPhoto.length === 0) {
      return res.status(400).json({ error: 'At least one file must be uploaded for each document type' })
    }

    // Use application ID from request (generated by frontend)
    // This ensures consistency between frontend, backend, and payment intent metadata


    // Upload files to Supabase Storage
    let uploadedDriversLicense = []
    let uploadedPassportPhoto = []
    let uploadedSignature = null

    try {
      // Upload driver's license files
      uploadedDriversLicense = await uploadFilesToStorage(
        fileData.driversLicense,
        applicationId,
        'drivers_license'
      )

      // Upload passport photo files
      uploadedPassportPhoto = await uploadFilesToStorage(
        fileData.passportPhoto,
        applicationId,
        'passport_photo'
      )

      // Upload signature if present
      if (formData.signature) {
        const signatureFile = {
          data: formData.signature,
          name: 'signature.png',
          type: 'image/png',
          size: Math.round(formData.signature.length * 0.75) // Estimate base64 size
        }
        
        const signatureResult = await uploadFilesToStorage(
          [signatureFile],
          applicationId,
          'signature'
        )
        uploadedSignature = signatureResult[0] // First (and only) signature file
      }

    } catch (uploadError) {
      console.error('File upload failed:', uploadError)
      return res.status(500).json({ 
        error: 'Failed to upload files to storage',
        details: uploadError.message
      })
    }

    // Prepare file metadata for database (URLs instead of base64)
    const fileMetadata = {
      driversLicense: uploadedDriversLicense,
      passportPhoto: uploadedPassportPhoto,
      signature: uploadedSignature // Add signature metadata
    }

    // Clean form data - remove base64 signature since it's now in storage
    const cleanFormData = { ...formData }
    delete cleanFormData.signature

    // Determine fulfillment type based on shipping category and country
    const fulfillmentType = determineFulfillmentType(
      formData.shippingCategory,
      formData.shippingCountry, // This will come from the custom shipping form fields
      formData.internationalFullAddress // Pass international address for country extraction
    )

    console.log('Fulfillment determination:', {
      shippingCategory: formData.shippingCategory,
      shippingCountry: formData.shippingCountry,
      internationalFullAddress: formData.internationalFullAddress,
      fulfillmentType: fulfillmentType
    })

    // Normalize shipping country to 2-character code
    // For domestic/military, default to 'US' if not provided
    let shippingCountryToNormalize = formData.shippingCountry
    if ((formData.shippingCategory === 'domestic' || formData.shippingCategory === 'military') && !shippingCountryToNormalize) {
      shippingCountryToNormalize = 'US'
    }
    const normalizedShippingCountry = normalizeCountryCode(shippingCountryToNormalize) || (formData.shippingCategory === 'domestic' || formData.shippingCategory === 'military' ? 'US' : null)
    
    // Save application to database with file URLs and international fields
    console.log('=== DATABASE INSERT DEBUG ===')
    console.log('About to insert international fields:', {
      international_full_address: formData.internationalFullAddress || null,
      international_local_address: formData.internationalLocalAddress || null,
      international_delivery_instructions: formData.internationalDeliveryInstructions || null,
      shipping_country_original: formData.shippingCountry,
      shipping_country_normalized: normalizedShippingCountry
    })
    
    const { data, error } = await supabase
      .from('applications')
      .insert({
        application_id: applicationId,
        form_data: cleanFormData,
        file_urls: fileMetadata, // Store URLs instead of base64
        payment_status: 'pending',
        fulfillment_type: fulfillmentType, // Add fulfillment type for Make automation
        
        // Personal information (denormalized)
        first_name: formData.firstName,
        middle_name: formData.middleName || null,
        last_name: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        date_of_birth: formData.dateOfBirth || null, // YYYY-MM-DD format
        
        // License information (denormalized)
        license_number: formData.licenseNumber,
        license_state: formData.licenseState,
        license_expiration: formData.licenseExpiration || null,
        license_types: formData.licenseTypes || [], // Array: ['passenger', 'motorcycle', etc.]
        
        // Address information (denormalized)
        street_address: formData.streetAddress,
        street_address_2: formData.streetAddress2 || null,
        city: formData.city,
        state: formData.state,
        zip_code: formData.zipCode,
        
        // Birthplace (denormalized)
        birthplace_city: formData.birthplaceCity,
        birthplace_state: formData.birthplaceState,
        
        // Travel information (denormalized)
        drive_abroad: formData.driveAbroad,
        departure_date: formData.departureDate || null, // YYYY-MM-DD format
        permit_effective_date: formData.permitEffectiveDate || null, // YYYY-MM-DD format
        selected_permits: formData.selectedPermits || [], // Array: ['idp', 'iadp']
        
        // Shipping and processing (denormalized)
        shipping_category: formData.shippingCategory, // 'domestic', 'international', 'military'
        processing_option: formData.processingOption, // 'standard', 'fast', 'fastest'
        shipping_label_generated: fulfillmentType === 'automated', // true if automated
        ship_by_date: calculateShipByDate(formData.processingOption),
        
        // Shipping address fields (individual columns per CSV requirement)
        shipping_recipient_name: formData.recipientName || `${formData.firstName} ${formData.lastName}`,
        shipping_recipient_phone: formData.recipientPhone || formData.shippingPhone || formData.phone,
        // For domestic/military: use shipping address fields
        shipping_street_address: (formData.shippingCategory !== 'international' && formData.shippingStreetAddress) ? formData.shippingStreetAddress : null,
        shipping_street_address_2: (formData.shippingCategory !== 'international' && formData.shippingStreetAddress2) ? formData.shippingStreetAddress2 : null,
        shipping_city: (formData.shippingCategory !== 'international' && formData.shippingCity) ? formData.shippingCity : null,
        shipping_state: (formData.shippingCategory !== 'international' && formData.shippingState) ? formData.shippingState : null,
        shipping_postal_code: (formData.shippingCategory !== 'international' && formData.shippingPostalCode) ? formData.shippingPostalCode : null,
        shipping_delivery_instructions: formData.shippingDeliveryInstructions || formData.internationalDeliveryInstructions || null,
        
        // Extract international shipping fields to individual columns
        international_full_address: formData.internationalFullAddress || null,
        international_local_address: formData.internationalLocalAddress || null,
        international_delivery_instructions: formData.internationalDeliveryInstructions || null,
        shipping_country: normalizedShippingCountry, // Normalized to 2-character code
        pccc_code: formData.pcccCode || null
      })
      .select()

    console.log('Database insert result:', { data, error })
    console.log('=== END DATABASE DEBUG ===')

    if (error) {
      console.error('=== DATABASE INSERT FAILED ===')
      console.error('Error code:', error.code)
      console.error('Error message:', error.message)
      console.error('Error details:', error.details)
      console.error('Error hint:', error.hint)
      console.error('Full error:', JSON.stringify(error, null, 2))
      return res.status(500).json({ 
        error: 'Failed to save to database',
        details: error.message,
        code: error.code,
        hint: error.hint
      })
    }

    if (!data || !data[0]) {
      console.error('=== DATABASE INSERT RETURNED NO DATA ===')
      console.error('Data:', data)
      return res.status(500).json({ 
        error: 'Database insert succeeded but returned no data',
        details: 'Insert may have failed silently'
      })
    }

    // Calculate pricing
    const pricing = calculatePricing(formData)

    res.status(200).json({
      success: true,
      applicationId: applicationId,
      data: data[0],
      pricing: pricing
    })

  } catch (error) {
    console.error('Save application error:', error)
    
    // Ensure CORS headers are set even in error responses
    const origin = req.headers.origin
    const allowedOrigins = [
      'https://fastidp.com',
      'https://www.fastidp.com',
      'https://framer.app', 
      'https://preview.framer.app'
    ]
    
    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
    } else {
      // Default to live domain
      res.setHeader('Access-Control-Allow-Origin', 'https://fastidp.com')
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, User-Agent')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Max-Age', '86400')
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type')
    
    res.status(500).json({ 
      error: 'Failed to save application',
      details: error.message
    })
  }
}

// Helper function to calculate pricing
function calculatePricing(formData) {
  let total = 0
  const lineItems = []

  // Add permit costs
  if (formData.selectedPermits && formData.selectedPermits.length > 0) {
    formData.selectedPermits.forEach(permit => {
      if (permit === 'International Driving Permit') {
        lineItems.push({
          productId: STRIPE_PRODUCTS.idp_international,
          name: 'International Driving Permit',
          price: PERMIT_PRICES.idp,
          quantity: 1
        })
        total += PERMIT_PRICES.idp
      } else if (permit === 'IAPD (Brazil / Uruguay only)') {
        lineItems.push({
          productId: STRIPE_PRODUCTS.idp_brazil_uruguay,
          name: 'IAPD (Brazil / Uruguay only)',
          price: PERMIT_PRICES.iapd,
          quantity: 1
        })
        total += PERMIT_PRICES.iapd
      }
    })
  }

  // NOTE: Processing costs are combined with shipping below
  // Add combined processing & shipping cost
  if (formData.shippingCategory && formData.processingOption) {
    const category = formData.shippingCategory
    const speed = formData.processingOption
    const combinedPrice = getCombinedPrice(category, speed)
    const combinedName = getSpeedDisplayName(speed)
    
    if (combinedPrice > 0) {
      lineItems.push({
        productId: `processing_shipping_${category}_${speed}`,
        name: combinedName,
        price: combinedPrice,
        quantity: 1
      })
      total += combinedPrice
    }
  }

  return {
    lineItems,
    total,
    subtotal: total,
    currency: 'usd'
  }
}
