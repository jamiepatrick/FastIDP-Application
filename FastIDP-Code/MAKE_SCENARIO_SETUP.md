# Make.com Scenario Setup — Current Configuration

*Documenting the actual Make scenario so guidance is accurate. Add details as you share more.*

---

## Flow Overview

1. **Webhooks (4)** — Custom webhook (START)
2. *(wrench icon — transformation/setup)*
3. **Supabase (2)** — Search Rows
4. **Router (93)** — Branches by `fulfillment_type`
   - **1st Automated** → EasyPost (13) — Create a Parcel
   - **fallback Manual** → PandaDoc (95) — Create a Document

---

## Router 93 — Filters

### Automated route
- **Label:** Automated
- **Fallback:** No
- **Condition:** `fulfillment_type` Equal to `"automated"`
- **Path:** → EasyPost (13) Create a Parcel

### Manual route
- **Label:** Manual
- **Fallback:** Yes (fallback route)
- **Condition:** `fulfillment_type` Equal to `"manual"`
- **Path:** → PandaDoc (95) Create a Document

---

## Between Webhooks and Supabase

- Nothing — the Supabase module is there to reference later (data available for use downstream)

---

## Automated Flow (after Router 93 — 1st Automated)

**Sequence:**
1. **EasyPost 13** — Create a Parcel
2. **EasyPost 59** — Create a Shipment
3. **Groq 25** — Create a Chat Completion
4. **EasyPost 60** — Buy a Shipment
5. **HTTP (legacy) 101** — Get a file

---

### EasyPost 13 — Create a Parcel
- Weight: 2 (OZ)
- Length: 9.5
- Width: 12.5
- Height: 0.1
- Predefined Package: (empty)
- Connection: My EasyPost connection

### EasyPost 59 — Create a Shipment
- **To Address:** Mapped from `4.shipping_address` (line1, line2, city, state)
- **From Address:** Address ID `adr_3669fdaed57311f0ba52ac1f6bc53342` (mapped)
- **Parcel:** Parcel ID from `13. Parcel ID` (output of step 13)
- **Carrier Accounts:** USPS ✓, DHL Express ✓, FedEx ✓, UPSDAP ✓ | FedEx Default ✗
- **Reference:** (empty)

### Groq 25 — Create a Chat Completion
- **Model:** llama-3.3-70b-versatile
- **Messages:**
  - Item 1: "Look into the data: 59. Rates []. And give the Rate ID of the lowest Rate, Look into the raw name of the rate as the lowest (raw name: rate). Note: The output result should be in a text format"
  - Item 2: "Don't include any additional text to the output result, just the RATE ID of the lowest rate"
- **Purpose:** Picks the lowest rate from EasyPost 59 rates

### EasyPost 60 — Buy a Shipment
- **Shipment ID:** From 59 (Create a Shipment output)
- **Rate ID:** From Groq output (lowest rate ID)
- **Insurance:** (empty)

### HTTP (legacy) 101 — Get a file
- **URL:** `60. Postage Label: Label URL`
- **Purpose:** Fetches the label PDF

---

## Automated Flow — Batch 2 (after HTTP 101)

**Sequence:**
6. **PandaDoc 37** — Create a Document
7. **PandaDoc 90** — Download a Document
8. **Gmail 42** — Send an Email

---

### PandaDoc 37 — Create a Document
- **Connection:** Fast IDP 2025
- **Document Name:** `4.customer.full_name` - IDP Document
- **Template ID:** IDP_Application2a
- **Tokens / Role mappings (from webhook `4.`):**
  - Birthplacecity, Client City: `4.license_info.birthplace_city`
  - Client Country: `4.license_info.birthplace_sta`
  - Client Email: `4.customer.email`
  - Client First Name: `4.customer.first_name`
  - Client Last Name: `4.customer.last_name`
  - Client Phone: `4.customer.phone`
  - Client Street Address: `4.form_address.street_address`

### PandaDoc 90 — Download a Document
- **Connection:** Fast IDP 2025
- **Document ID:** `37. Document ID` (output of PandaDoc 37)

### Gmail 42 — Send an Email
- **Connection:** My Google Restricted
- **To:** wilke.gabe1@gmail.com, jamie@fastidp.com
- **Subject:** New IDP Application for `4.customer.full_name` (AUTOMATED)
- **Content (HTML):**
  - Heading: New Fast IDP Submission for **Automated Processing**
  - Additional Details: Permit Type (`4.selections.selected_permits[]`), Type of License (`4.selections.license_types[]`)
  - Files and Attachments: Label attached, Tracking # (`60. Tracking Code`)
  - Links: Front/Back License 1–3 (`4.customer_files.id_document_url_1`, etc.), Passport Photo 3–5 (`4.customer_files.passport_photo_url_3`, etc.), Signature (`4.customer_files.signature_url`)
- **Attachments:**
  - Item 1: PandaDoc Download a Document — Content-ID: `90. Data`
  - Item 2: HTTP (legacy) Get a file (label PDF) — Content-ID: `101. File name`

---

## Automated Flow — Batch 3 (receipt, Supabase, admin logging)

**Sequence:**
9. **HTTP (legacy) 118** — Make a request (details sent)
10. **Gmail 119** — Send an Email (receipt)
11. **Supabase 121** — Search Rows
12. **Google Sheets 103** — Add a Row (admin logging)

**Purpose:** Details are requested then sent to an email as a receipt, then Supabase is queried and data from Supabase + the initial webhook are added to an admin Google Sheet for logging automated runs that admin can review.

---

### HTTP (legacy) 118 — Make a request
- **Content type:** JSON (application/json)
- **Request body (JSON):**
  - `application_id`: `2. application_id`
  - `tracking_number`: `60. Tracker: Tracking Code`
  - `easypost_shipment_id`: `60. Shipment ID`
  - `shipping_carrier`: `60. Selected Rate: Carrier`
  - `shipping_service`: `60. Selected Rate: Service`
  - `shipping_cost`: `60. Selected Rate: Rate`
  - `shipping_label_url`: `60. Postage Label: Label URL`
  - `shipping_label_pdf_url`: `60. Postage Label: Label PDF URL`
  - `shipping_label_generated`: true
  - `make_automation_status`: `"completed"`
- **Parse response:** No

### Gmail 119 — Send an Email
- Receipt email (details sent)

### Supabase 121 — Search Rows
- Pulls data for admin sheet

### Google Sheets 103 — Add a Row
- Adds data from Supabase + initial webhook to admin sheet for logging automated runs

---

## To Be Documented (pending more batches)
- [ ] Supabase Search Rows — what it does
- [ ] Manual path — PandaDoc (95) Create a Document (different from automated PandaDoc 37)
