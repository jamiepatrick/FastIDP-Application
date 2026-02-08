# Make.com — Next Steps

Use this file as a checklist for fixing the automated flow. See `MAKE_SCENARIO_SETUP.md` for the full current configuration.

---

## What's Already Done

- **Router 93** — Routes by `fulfillment_type` (Automated → EasyPost, Manual fallback → PandaDoc)
- **Automated flow** — Webhook → Supabase → Router → EasyPost 13 (Parcel) → EasyPost 59 (Shipment) → Groq 25 → EasyPost 60 (Buy) → HTTP 101 (label) → PandaDoc → Gmail → HTTP 118 → Gmail (receipt) → Supabase → Google Sheets

---

## What Needs to Be Fixed

### Rate Selection (Groq 25)

**Current behavior:** Groq 25 picks the **lowest** rate from `59. Rates []`:
> "Look into the data: 59. Rates []. And give the Rate ID of the lowest Rate"

**Required behavior:** Use `carrier` and `requested_service` from the webhook to select the **matching** rate — do **not** use the lowest rate across all carriers.

| Field | Webhook path | Example |
|-------|--------------|---------|
| `carrier` | `4.easypost_shipment.carrier` | `"FedEx"` or `"USPS"` |
| `requested_service` | `4.easypost_shipment.requested_service` | `"FedEx 2Day"`, `"FedEx Priority Overnight"`, etc. |

**Fix:**
1. Replace (or modify) **Groq 25** with deterministic logic:
   - Iterate over `59. Rates []`
   - Filter to find the rate where `rate.carrier` = `4.easypost_shipment.carrier` **and** `rate.service` = `4.easypost_shipment.requested_service`
   - Use that rate's Rate ID for EasyPost 60 Buy a Shipment

2. In Make.com, use **Iterator** over `59. Rates []` + **Filter** (or **Router**) to select the matching rate by `carrier` and `service`.

---

## Error Handling — No Matching Rate

If no rate matches `carrier` + `requested_service`:
- Do **not** fall back to the lowest rate.
- Branch to an error path:
  - Send alert (email, Slack, etc.)
  - Create manual work order
  - Log for debugging

---

## Carrier & Service Reference

From `config/shipping-services.js` and `SHIPPING_SPEC.md`:

| Shipping | Speed | Carrier | Service |
|----------|-------|---------|---------|
| Domestic | Fastest | FedEx | FedEx Priority Overnight |
| Domestic | Fast | FedEx | FedEx 2Day |
| Domestic | Standard | FedEx | FedEx 2Day |
| International (automated) | Any | FedEx | FedEx International Priority |
| International (manual) | N/A | — | No carrier sent |
| Military | Fastest | USPS | Priority Express |
| Military | Fast | USPS | Priority Express |
| Military | Standard | USPS | Priority |

---

## Optional — Verify EasyPost Service Names

EasyPost rate objects use a `service` field. If rate selection fails, check the actual EasyPost response (`59. Rates []`) and confirm the service strings match exactly (e.g. `"FedEx 2Day"` vs `"FEDEX_2_DAY"`). Adjust `config/shipping-services.js` if needed.

---

## Reference Files

| File | Purpose |
|------|---------|
| `MAKE_SCENARIO_SETUP.md` | Full Make scenario configuration |
| `SHIPPING_SPEC.md` | Human-readable carrier rules |
| `config/shipping-services.js` | Source of carrier + service logic |
| `api/webhook.js` | Builds the Make.com payload |
