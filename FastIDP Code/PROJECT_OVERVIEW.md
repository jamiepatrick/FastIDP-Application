# FastIDP Project Overview — Start Here

**Use this file when you open the project so any session or agent knows exactly what we're doing and how the project is set up.**

---

## 1. Open the Correct Workspace (Critical)

- **Correct way to work on this project:**
  - **Option A:** File → Open Folder → choose the folder **`FastIDP Code`** (with a space).  
  - **Option B:** File → Open Workspace from File → open **`FastIDP Code.code-workspace`** (inside this same folder).

- **Do not open** the **parent** folder `FastIDP` (that’s the git repo root; opening it shows sibling folders and can confuse Cursor / agent context).

- **Why this matters:** Opening the wrong folder or parent loses Cursor’s context and agent memory. Always open **FastIDP Code** (the folder or its `.code-workspace` file).

---

## 2. What This Project Is

- **Product:** FastIDP — International Driving Permit (IDP) application and payment flow.
- **Client:** Jamie (project owner). **Agency:** Gabe / Pryzm Web (you).
- **Repo:** GitHub **jamiepatrick/FastIDP-Application** (branch `main`). You push as collaborator (e.g. Gabe-W88).
- **Deploy:** Vercel, connected to that repo. **Root Directory in Vercel:** set to **`FastIDP Code`** (with a space).  
  **Note:** Vercel rejects serverless function paths that contain a space, so builds may fail with “invalid function name.” To fix without renaming this folder, move the app contents to the repo root and set Vercel Root Directory to empty (see Gotchas below).

---

## 3. Repo and Folder Structure

- **Git repo root:** One level **above** this folder.  
  - Full path example: `…/FastIDP/` (repo root) and `…/FastIDP/FastIDP Code/` (this app).
- **This folder (`FastIDP Code`)** is the application root. It contains:
  - **`api/`** — Vercel serverless functions (webhook, save-application, validate-coupon, etc.).
  - **`config/`** — pricing, coupons, **shipping-services.js** (carrier + service by category/speed).
  - **`data/`** — e.g. **countries-automation.csv** (which international countries get automated shipping).
  - **`src/`** — React app (App.jsx, main.jsx).
  - **`SHIPPING_SPEC.md`** — single source of truth for carrier/service rules.
  - **`README.md`** — high-level flow and URLs for the client.
  - **`vercel.json`** — Vercel config (functions, rewrites).
  - **`FastIDP Code.code-workspace`** — Cursor/VS Code workspace (use this or open the folder).

---

## 4. Tech Stack (Summary)

| Layer        | Technology                    |
|-------------|-------------------------------|
| Frontend    | React (hosted on Framer)      |
| Backend     | Vercel serverless (Node)     |
| Database    | Supabase (project ref in env)|
| Payments    | Stripe                        |
| Automation  | Make.com                      |
| Shipping    | EasyPost (labels/rates)      |

---

## 5. What’s Implemented (Shipping & Backend)

- **SHIPPING_SPEC.md** — Carrier and service rules (FedEx domestic/international, USPS military).
- **config/shipping-services.js** — `getShippingCarrierAndService(category, speed, fulfillmentType)` returns `{ carrier, requested_service }` for the webhook and Make.
- **api/webhook.js** — After payment, builds payload for Make.com including:
  - **easypost_shipment.carrier** and **easypost_shipment.requested_service** from shipping-services config.
  - **fulfillment_type** from the Supabase row (automated vs manual).
- **api/save-application.js** — **Fulfillment type:** domestic/military = automated; international = automated only if country is in **data/countries-automation.csv** with "Yes". The previous “force all international to manual” patch was removed.

---

## 6. Make.com (Next / Pending)

- **Router 93:** Route by `fulfillment_type` (automated vs manual).
- **EasyPost:** Use **carrier** and **requested_service** from the webhook payload to pick the correct rate (or restrict Create Shipment to that carrier). Do **not** use “lowest rate across all carriers.”
- **Error handling:** Add a path when no EasyPost rate matches the requested carrier + service.
- Optional: Confirm EasyPost rate object field names (e.g. `service`) against a real Create Shipment response and align **config/shipping-services.js** service strings if needed.

---

## 7. Key File Reference

| Purpose                         | File(s) |
|---------------------------------|--------|
| Shipping rules (human-readable) | **SHIPPING_SPEC.md** |
| Carrier + service for code/Make | **config/shipping-services.js** |
| Which countries are automated  | **data/countries-automation.csv** |
| Payment success → Make payload | **api/webhook.js** |
| Save application + fulfillment | **api/save-application.js** |
| Vercel config                  | **vercel.json** |
| This overview                  | **PROJECT_OVERVIEW.md** (this file) |

---

## 8. Common Gotchas

- **Vercel “invalid function name” / “must not contain any space”:** The path `FastIDP Code/api/…` has a space. Vercel requires no space in serverless function paths. **Fix without renaming this folder:** move everything from `FastIDP Code/` to the repo root (`FastIDP/`) so the path is just `api/*.js`, then set Vercel Root Directory to empty.
- **Cursor “no folders” / wrong tree:** You opened the parent `FastIDP` folder. Close and open **FastIDP Code** (folder or **FastIDP Code.code-workspace**).
- **Agent/context loss:** After opening, read this file so the session knows the correct workspace and current state.

---

## 9. One-Line Reminder

**Always open the folder or workspace named `FastIDP Code` (with a space); that’s the app. Everything in this doc assumes you’re in that folder.**
