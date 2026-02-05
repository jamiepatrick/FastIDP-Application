# FastIDP Project Overview — Start Here

**Read this first when you open the project. The human (Gabe) may be switching to a new AI agent; this file is the handoff.**

---

## 1. Open the Correct Workspace (Critical)

- **Open this project as:** the folder **`FastIDP-Code`** (with a hyphen, no space).
- **How:** File → Open Folder → choose **FastIDP-Code**, **or** File → Open Workspace from File → open **`FastIDP-Code.code-workspace`** (inside this folder).
- **Do not open** the parent folder **FastIDP** (that’s the git repo root; opening it loses context).
- The folder was renamed from "FastIDP Code" (space) to **FastIDP-Code** (hyphen) so Vercel can deploy (no spaces in serverless function paths).

---

## 2. What This Project Is

- **Product:** FastIDP — International Driving Permit (IDP) application and payment flow.
- **Client:** Jamie (project owner). **Agency:** Gabe / Pryzm Web.
- **Repo:** GitHub **jamiepatrick/FastIDP-Application** (branch **main**). Pushes as collaborator (e.g. Gabe-W88).
- **Deploy:** Vercel, connected to that repo. **Vercel Root Directory must be:** **`FastIDP-Code`** (hyphen).

---

## 3. Repo and Folder Structure

- **Git repo root:** One level above this folder (`…/FastIDP/`). This app lives in **`FastIDP-Code/`**.
- **This folder** contains:
  - **api/** — Vercel serverless functions (webhook, save-application, validate-coupon, etc.).
  - **config/** — pricing, coupons, **shipping-services.js** (carrier + service by category/speed).
  - **data/** — **countries-automation.csv** (source of truth for which international countries get automated shipping).
  - **src/** — React app (App.jsx, main.jsx).
  - **SHIPPING_SPEC.md** — single source of truth for carrier/service rules.
  - **README.md** — high-level flow and URLs for the client.
  - **vercel.json** — Vercel config.
  - **FastIDP-Code.code-workspace** — Cursor workspace file.

---

## 4. Tech Stack

| Layer     | Technology               |
|----------|---------------------------|
| Frontend | React (hosted on Framer)  |
| Backend  | Vercel serverless (Node) |
| Database | Supabase                  |
| Payments | Stripe                    |
| Automation | Make.com               |
| Shipping | EasyPost                  |

---

## 5. What’s Already Done (Shipping & Backend)

- **SHIPPING_SPEC.md** — Carrier and service rules (FedEx domestic/international, USPS military). Single source of truth.
- **config/shipping-services.js** — `getShippingCarrierAndService(category, speed, fulfillmentType)` returns `{ carrier, requested_service }`. Used by webhook and should be used by Make.com.
- **api/webhook.js** — After payment, builds payload for Make.com with:
  - **easypost_shipment.carrier** and **easypost_shipment.requested_service** from shipping-services config.
  - **fulfillment_type** from the Supabase row (automated vs manual).
- **api/save-application.js** — Fulfillment type: domestic/military = automated; international = automated **only if** country is in **data/countries-automation.csv** with "Yes". The code **reads the CSV** at load time (no hardcoded list); CSV is the source of truth.
- **Folder name** — **FastIDP-Code** (no space) so Vercel deploys successfully.

---

## 6. What’s Next (For the Next Agent / Gabe’s Notes)

- **Client notes and shipping specs** — Gabe has notes and shipping specs; continue implementing or refining from those.
- **Make.com:**
  - Router 93: route by **fulfillment_type** (automated vs manual).
  - Use **carrier** and **requested_service** from the webhook payload to select the correct EasyPost rate (do **not** use “lowest rate across all carriers”).
  - Add error handling when no rate matches carrier + requested_service.
- **Optional:** Confirm EasyPost rate object field names (e.g. `service`) from a real Create Shipment response and align **config/shipping-services.js** service strings if needed.

---

## 7. Key File Reference

| Purpose                          | File(s) |
|----------------------------------|--------|
| Shipping rules (human-readable)  | **SHIPPING_SPEC.md** |
| Carrier + service for code/Make  | **config/shipping-services.js** |
| Which countries are automated   | **data/countries-automation.csv** (read by save-application.js) |
| Payment success → Make payload  | **api/webhook.js** |
| Save application + fulfillment  | **api/save-application.js** |
| Vercel config                   | **vercel.json** |
| This handoff/overview           | **PROJECT_OVERVIEW.md** (this file) |

---

## 8. Gotchas

- **Vercel:** Root Directory must be **FastIDP-Code** (hyphen). The repo folder name is **FastIDP-Code**; no space.
- **Cursor:** Open **FastIDP-Code** (folder or workspace file). Opening the parent **FastIDP** loses agent context.
- **CSV:** International automation is driven by **data/countries-automation.csv** (column “Automate shipping label creation?” = Yes). The code loads it in save-application.js; no hardcoded country list.

---

## 9. One-Line Reminder

**Open the folder or workspace `FastIDP-Code` (hyphen). That’s the app. Use PROJECT_OVERVIEW.md and SHIPPING_SPEC.md plus Gabe’s notes to continue.**
