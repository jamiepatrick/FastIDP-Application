# Email to EasyPost Support

Subject: Request for Request/Response Transcript & FedEx Negotiated Rates with Carrier-Agnostic Rate Shopping

---

Hi [EasyPost Support Name],

Thank you for your previous response. I have a follow-up question that I'm hoping you can help clarify.

**Current Situation:**

We're using EasyPost through Make.com to automate shipping label creation. Our workflow is:
1. Create a Parcel (custom dimensions: 9.5 x 12.5 x 0.1 inches, 2 oz, no predefined_package)
2. Create a Shipment (to get rates from all carriers)
3. Use AI to select the lowest rate
4. Buy the Shipment with the selected rate

**The Problem:**

We want to shop rates across all carriers (FedEx, UPS, USPS) to find the best price, which requires NOT using `predefined_package` (as you mentioned, using predefined_package limits us to that carrier only).

However, when we don't use `predefined_package`, we're not seeing our FedEx negotiated rates. The FedEx rates we get are higher than what we see when we log directly into our FedEx account.

When we DO use `predefined_package: "FedExEnvelope"`, we see our negotiated FedEx rates correctly, but then we can only see FedEx services - we lose the ability to compare across carriers.

**Questions:**

1. **Request/Response Transcript:** Could you please provide a request/response transcript for a FedEx Priority Overnight shipment so we can share it with our FedEx rep to understand the rate discrepancy? (Same shipment details: 9.5 x 12.5 x 0.1 inches, 2 oz, from our origin to a test destination)

2. **Negotiated Rates Without Predefined Package:** Is it possible to get our FedEx negotiated rates when NOT using `predefined_package`? We need carrier-agnostic rate shopping, but we also need accurate FedEx rates.

3. **Workflow Options:** If negotiated rates only work with `predefined_package`, would we need to:
   - Create two separate shipments (one with FedEx predefined_package, one without)?
   - Compare rates manually between the two?
   - Or is there a better way to handle this?

**What We're Trying to Achieve:**

- Shop rates across all eligible carriers (FedEx, UPS, USPS)
- See accurate negotiated rates for each carrier
- Automatically select the best rate
- Use the appropriate carrier's envelope when fulfilling

We're eager to get this working correctly. Any guidance you can provide would be greatly appreciated!

Best regards,
Jamie
Fast IDP

---


