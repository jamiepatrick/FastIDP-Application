# FastIDP - International Driving Permit Application System

## What This Is

A web application that processes International Driving Permit (IDP) applications. Customers fill out a form, upload documents, and pay online. The system automatically processes orders and creates shipping labels.

## How to View Applications

All applications are stored in **Supabase** (your database).

1. Go to [Supabase Dashboard](https://supabase.com)
2. Log in to your project
3. Click **Table Editor** → **applications**
4. You'll see all submitted applications with all their information

## What Happens When Someone Submits an Application

### Step-by-Step Flow

**1. Customer Fills Out Form**
- Personal information (name, email, phone, address)
- Driver's license details
- Document uploads (license photo, passport photo, signature)
- Shipping preferences (domestic, international, or military)
- Processing speed selection (standard, fast, or fastest)

**2. Form Submission**
- All data is saved to Supabase database
- Files are uploaded to Supabase Storage
- Application gets a unique ID (like `APP-1765569589266-6vb5wo9zg`)

**3. Payment Processing**
- Customer enters payment information
- Payment is processed through Stripe
- If payment succeeds → Continue to step 4
- If payment fails → Customer sees error, can try again

**4. After Successful Payment**
- Stripe sends a webhook to your system
- System updates the application status to "completed" in Supabase
- Make.com automation is triggered automatically

**5. Make.com Automation**
- Receives all application data
- For **automated countries** (20+ countries):
  - Creates shipping label automatically via EasyPost
  - Updates Supabase with tracking number
  - Sends confirmation email to customer
- For **manual countries**:
  - Creates work order for manual processing
  - Sends notification for manual review

**6. Tracking Updates**
- When shipping label is created, tracking number is saved to Supabase
- Customer notified vie email

### Different Scenarios

**Domestic Shipping (US addresses):**
- Fastest processing (usually 1-2 days)
- Shipping via USPS
- Fully automated

**International Shipping (20+ automated countries):**
- Includes: UK, Canada, Australia, Mexico, and others
- Shipping label created automatically
- Customs forms generated automatically
- Tracking number provided

**International Shipping (Other countries):**
- Requires manual review
- Work order created in Make.com
- Manual processing and shipping label creation

**Military Shipping:**
- Special handling for APO/FPO addresses
- USPS Military Mail
- Fully automated

### What Gets Saved to Supabase

Every application includes:
- All personal information
- License details
- Shipping address
- Selected permits and processing options
- Payment status and amount
- Tracking number (when available)
- File URLs (links to uploaded documents)
- Timestamps (when submitted, when paid, etc.)

## Important URLs

- **Frontend (Form):** fastidp.com
- **Backend API:** `https://fastidp.vercel.app`
- **Database:** Supabase Dashboard
- **Payments:** Stripe Dashboard
- **Automation:** Make.com Dashboard

## Tech Stack (For Reference)

- **Frontend:** React (hosted on Framer)
- **Backend:** Vercel serverless functions
- **Database:** Supabase (PostgreSQL)
- **Payments:** Stripe
- **Automation:** Make.com
- **Address Validation:** EasyPost

