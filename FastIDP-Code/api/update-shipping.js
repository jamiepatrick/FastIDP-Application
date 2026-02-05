import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const {
      application_id,
      tracking_number,
      tracking_code,
      tracking_url,
      easypost_shipment_id,
      shipping_carrier,
      shipping_service,
      shipping_cost,
      estimated_delivery_date,
      shipping_label_url,
      shipping_label_pdf_url,
      work_order_pdf_url,
      shipping_label_generated,
      make_automation_status,
      make_automation_error
    } = req.body

    // Validate required field
    if (!application_id) {
      return res.status(400).json({ 
        error: 'application_id is required' 
      })
    }

    console.log('=== UPDATE SHIPPING DATA ===')
    console.log('application_id:', application_id)
    console.log('Received data:', {
      tracking_number,
      tracking_code,
      tracking_url,
      easypost_shipment_id,
      shipping_carrier,
      shipping_service,
      shipping_cost,
      estimated_delivery_date,
      shipping_label_url,
      shipping_label_pdf_url,
      work_order_pdf_url,
      shipping_label_generated,
      make_automation_status
    })

    // Build update object (only include fields that are provided)
    const updateData = {
      updated_at: new Date().toISOString()
    }

    // Add fields only if they're provided (not null/undefined)
    if (tracking_number !== undefined && tracking_number !== null) {
      updateData.tracking_number = tracking_number
    }
    if (tracking_code !== undefined && tracking_code !== null) {
      updateData.tracking_code = tracking_code
    }
    if (tracking_url !== undefined && tracking_url !== null) {
      updateData.tracking_url = tracking_url
    }
    if (easypost_shipment_id !== undefined && easypost_shipment_id !== null) {
      updateData.easypost_shipment_id = easypost_shipment_id
    }
    if (shipping_carrier !== undefined && shipping_carrier !== null) {
      updateData.shipping_carrier = shipping_carrier
    }
    if (shipping_service !== undefined && shipping_service !== null) {
      updateData.shipping_service = shipping_service
    }
    if (shipping_cost !== undefined && shipping_cost !== null) {
      updateData.shipping_cost = typeof shipping_cost === 'string' 
        ? parseFloat(shipping_cost) 
        : shipping_cost
    }
    if (estimated_delivery_date !== undefined && estimated_delivery_date !== null) {
      updateData.estimated_delivery_date = estimated_delivery_date
    }
    if (shipping_label_url !== undefined && shipping_label_url !== null) {
      updateData.shipping_label_url = shipping_label_url
    }
    if (shipping_label_pdf_url !== undefined && shipping_label_pdf_url !== null) {
      updateData.shipping_label_pdf_url = shipping_label_pdf_url
    }
    if (work_order_pdf_url !== undefined && work_order_pdf_url !== null) {
      updateData.work_order_pdf_url = work_order_pdf_url
    }
    if (shipping_label_generated !== undefined && shipping_label_generated !== null) {
      updateData.shipping_label_generated = shipping_label_generated === true || shipping_label_generated === 'true'
    }
    if (make_automation_status !== undefined && make_automation_status !== null) {
      updateData.make_automation_status = make_automation_status
    }
    if (make_automation_error !== undefined && make_automation_error !== null) {
      updateData.make_automation_error = make_automation_error
    }

    console.log('Updating application with:', updateData)

    // Update the application
    const { data, error } = await supabase
      .from('applications')
      .update(updateData)
      .eq('application_id', application_id)
      .select('application_id, tracking_number, tracking_code, shipping_label_generated')
      .single()

    if (error) {
      console.error('Database update error:', error)
      return res.status(500).json({ 
        error: 'Failed to update shipping data',
        details: error.message 
      })
    }

    if (!data) {
      return res.status(404).json({ 
        error: 'Application not found',
        application_id 
      })
    }

    console.log('Successfully updated shipping data:', data)

    return res.status(200).json({
      success: true,
      message: 'Shipping data updated successfully',
      application_id: data.application_id,
      updated_fields: Object.keys(updateData).filter(key => key !== 'updated_at')
    })

  } catch (error) {
    console.error('=== UPDATE SHIPPING ERROR ===')
    console.error('Error:', error)
    console.error('Stack:', error.stack)
    
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    })
  }
}

