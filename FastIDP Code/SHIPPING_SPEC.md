# FastIDP Shipping Spec

Single source of truth for carrier and service rules. Used by the app (webhook) and by Make.com to select the correct EasyPost rate.

## FedEx

| Scope | Speed | FedEx Service |
|-------|--------|----------------|
| Domestic (all US) | Fastest | FedEx Priority Overnight |
| Domestic | Fast | FedEx 2 Day |
| Domestic | Standard | FedEx 2 Day |
| International (automated only) | Any | FedEx International Priority |
| International (non-automated) | N/A | No automated label; manual fulfillment |

## USPS

| Scope | Speed | USPS Service |
|-------|--------|----------------|
| Military only | Fastest | Priority Express |
| Military only | Fast | Priority Express |
| Military only | Standard | Priority |

Customer does not pay shipping for military; we absorb cost.

## Automation

- **Domestic:** Always automated. Carrier = FedEx.
- **Military:** Always automated. Carrier = USPS.
- **International:** Automated only when country is in `data/countries-automation.csv` with "Yes". Carrier = FedEx, service = International Priority. All other international = manual (no carrier sent to Make).

## Make.com

- Router 93: route by `fulfillment_type` (automated vs manual).
- For automated path: use `carrier` and `requested_service` from webhook payload to filter EasyPost rates (or pass carrier to Create Shipment when possible). Do not use "lowest rate across all carriers."
- Add error path when no rate matches carrier + requested_service.
