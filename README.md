# SmartKart — Goal-Driven E-Commerce & Buyer Protection Platform

> **An Indian retail commerce platform (`₹ INR`) that pairs traditional catalogue shopping with goal-based bundle building, honest trade-off analysis, cart-hash-bound discount negotiation, and Razorpay UPI QR checkout—backed by deterministic server-side guardrails.**

---

## Why SmartKart Exists (The Product Problem)

Most e-commerce stores are built only for **SKU-level search**: if you already know you want a *"Keychron K2 V2"*, search works well. Put yourself in the shoes of a customer who only has a **goal and a budget**—such as *"Set up a quiet work-from-home desk under ₹15,000"* or *"Hostel room essentials under ₹5,000"*. Traditional stores force shoppers to open 20 tabs, manually track a running total, cross-check compatibility, and read dozens of reviews to spot hidden flaws.

**SmartKart** solves this by uniting **two complete shopping workflows** in one cohesive platform:
1. **Traditional Catalogue Shopping**: Fast filtering by category, price range, stock, and genuine buyer ratings, with honest *"Known trade-offs"* surfaced right on every Product Details page.
2. **Goal-Driven Intelligent Shopping**: Describe what you are setting up and your budget in plain English to get an editable bundle, run a pre-checkout **Smart Purchase Check** on your cart, ask for a bundle discount, and pay via **Razorpay UPI QR Scanner** or Cards/NetBanking.

---

## 6 Engineering Highlights (For Recruiters & Reviewers)

| Capability | What the User Experiences | Server-Side Engineering Guardrail |
| :--- | :--- | :--- |
| **1. Shop by Goal (`Your Suggested Bundle`)** | Describe a goal (e.g., *"Gaming desk setup under ₹30,000"*). Get a ready-to-edit bundle with a live budget progress bar (`Used` vs `Remaining`), checkboxes, quantity steppers, and a one-line *"Why this?"* rationale per item. | **Non-Destructive Scratchpad**: Proposals (`temporaryProposal: true`) never touch the persisted database cart until the user explicitly clicks **"Add X items to cart"**. Every suggested SKU is validated against live catalogue IDs and stock. |
| **2. Check My Cart (`Smart Purchase Check`)** | One click above the cart inspects every item against buyer reviews and technical specs, labeling each item as **Great pick** (`✓`), **Good fit** (`●`), or **Worth a second look** (`⚠`)—and offers 1-click **Swap for this** alternatives. | **Strict Visibility & Grounded Synthesis**: Only enabled when the persisted cart has $\ge 1$ item (`hasPersistedCartItems`). Never returns `"INSUFFICIENT DATA"`—if a product has 0 reviews, the engine synthesizes an honest assessment from its hardware specs and price tier. Swapping an item preserves its original cart quantity. |
| **3. Ask for a Discount (Cart-Hash Bound)** | Inside the Cart Order Summary, shoppers can request a bundle discount (e.g., *"Buying a complete study setup, can I get 10% off?"*) and receive an instant applied discount code. | **15% Hard Cap + Cryptographic Cart Binding**: Even if a user asks for 50% off, the server strictly caps discounts at **15%**. Approved offers are bound to a `SHA-256` hash of the exact cart (`productId:quantity`) with a 30-minute TTL. Any cart change immediately invalidates the discount and notifies the user. |
| **4. Trustworthy Review Separation** | Product pages display **Verified Purchase** reviews first, general **Customer Reviews** second, and collapse **Sample reviews (not from real customers)** at the bottom. | **Zero Rating Pollution**: The server assigns `VERIFIED_PURCHASE` *only* after verifying a `PAID` order containing that product. `DEMO` reviews are strictly excluded from `genuineRating` and `genuineReviewCount` calculations. |
| **5. Dual-Engine AI Resilience** | Every intelligent feature responds reliably in under 2 seconds whether or not external LLM quotas are available. | **Gemini + Deterministic Fallback**: Uses `@google/genai` with structured JSON schemas and automatically falls back to `services/fallback.service.js` if the API key is omitted, rate-limited, or returns unverified product IDs. |
| **6. Razorpay UPI QR & Signature Verification** | Clicking **Proceed to Checkout** opens a live **Razorpay Payment Gateway & UPI QR Scanner** with BharatQR, UPI ID (`@okicici`, `@ybl`), and the hosted `checkout.razorpay.com` modal. | **Paise Precision & HMAC-SHA256**: Server recomputes the final total from database prices + validated discount offer, creates a live Razorpay Order (`order_...`) in integer paise (`Math.round(finalTotal * 100)`), and verifies `HMAC-SHA256(order_id + "|" + payment_id, RAZORPAY_KEY_SECRET)` before marking the order `PAID`, decrementing stock, and clearing the cart. |

---

## System Architecture

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                     React 19 + Vite Frontend (SPA)                           │
│  ┌────────────────┐  ┌──────────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ Catalogue &    │  │ Shop by Goal     │  │ Cart, Check  │  │ Razorpay   │  │
│  │ Honest PDP     │  │ (Scratchpad UI)  │  │ Cart & Offer │  │ QR Gateway │  │
│  └───────┬────────┘  └────────┬─────────┘  └──────┬───────┘  └─────┬──────┘  │
└──────────┼────────────────────┼───────────────────┼────────────────┼─────────┘
           │ REST / JSON        │                   │                │
┌──────────▼────────────────────▼───────────────────▼────────────────▼─────────┐
│                     Node.js + Express 5 Backend API                          │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                SmartKart Intelligence Layer (`/api/ai/*`)              │  │
│  │  • Primary: Google Gemini (`@google/genai`) with JSON Schema Guard     │  │
│  │  • Fallback: Deterministic Rule Engine (`services/fallback.service.js`)│  │
│  │  • Validator: Catalogue SKU Verification + 15% Cap + SHA-256 CartHash  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │ Dual-Mode Persistence Layer       │  │ Payment & Order Engine          │  │
│  │ • Primary: MongoDB Atlas/Mongoose │  │ • Razorpay Orders SDK (Paise)   │  │
│  │ • Fallback: Zero-Config In-Memory │  │ • 256-bit HMAC-SHA256 Verifier  │  │
│  │   Store (38 Products + 17 Reviews)│  │ • Atomic Stock Decrement        │  │
│  └───────────────────────────────────┘  └─────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

- **Frontend**: React 19, Vite, React Router v7, Axios (JWT Bearer + Cookie interceptors), Lucide Icons, Custom Responsive CSS Grid/Flexbox Design System
- **Backend**: Node.js, Express 5, JSON Web Tokens (`jsonwebtoken`), `bcryptjs`
- **Database**: MongoDB Atlas + Mongoose 9, with an automatic **Zero-Config In-Memory Store (`inMemoryStore.js`)** so the app boots and passes all tests even without a live MongoDB connection
- **AI Engine**: Google Gemini SDK (`@google/genai`) + Deterministic Commerce Fallback Engine (`services/fallback.service.js`)
- **Payments**: Razorpay Node SDK (`razorpay`) + Razorpay Checkout.js + Interactive BharatQR / UPI Scanner (`Test Mode`)
- **Testing**: Node.js native test runner (`node --test tests/smartkart2.test.js`) covering 11 end-to-end integration tests across 7 suites

---

## 60-Second Live Demo Walkthrough

Want to evaluate the entire product quickly? Follow this path:

1. **1-Click Demo Login**:
   - Click **"Try Demo Account"** in the top navigation bar (or on the Home / Sign-In page) to sign in immediately without typing credentials.
2. **Shop by Goal (`/smart-shop`)**:
   - Click **"Shop by Goal"** in the navbar or pick a hero chip like *"Home gym & fitness essentials under ₹10,000"* or *"Gaming desk setup under ₹30,000"*.
   - Watch **Your Suggested Bundle** appear on the right with a budget progress bar (`Used` vs `Remaining`), one-line *"Why this?"* explanations, and a *"Customers also add this"* cross-sell card.
   - Adjust quantities with `-` / `+` or uncheck items—notice your actual cart badge in the navbar **does not change** until you click **"Add X items to cart · ₹..."**.
3. **Honest Product Details (`/products/:id`)**:
   - Open any product to see its genuine rating, stock urgency badge (*"Only X left"*), **Key Specifications**, **Known trade-offs** (surfaced honestly before you buy), **Verified Purchase** reviews first, and collapsed **Sample reviews (not from real customers)** last.
4. **Check My Cart & Swap an Item (`/cart`)**:
   - Add the *HyperPulse X100 Budget Gaming Headset* (or any item) to your cart and click **"Check My Cart"** directly above your cart items.
   - Inspect the **Smart Purchase Check** modal: items with comfort or durability concerns are flagged as **Worth a second look** (`⚠`) alongside better-rated in-stock alternatives. Click **"Swap for this"** to replace the item in your cart while preserving its quantity.
5. **Ask for a Discount (`/cart`)**:
   - In the right-hand Order Summary card, type *"Student buying a study bundle, can I get 15% off?"* into **Ask for a Discount** and click **Apply**.
   - Try changing an item's quantity afterward to see the automatic security invalidation notice when the cart hash changes.
6. **Razorpay UPI QR Scanner Checkout (`/checkout`)**:
   - Click **Proceed to Checkout** to open the **Razorpay Payment Gateway & UPI QR Scanner** connected to a live Razorpay Test Order (`order_...`).
   - Click **"Scan & Complete Payment"** (or launch the hosted Razorpay Cards/NetBanking window) to verify the `HMAC-SHA256` signature and view your **Order Status Timeline** (`PLACED → CONFIRMED → SHIPPED → DELIVERED`).

---

## Key API Endpoints

| Method & Endpoint | Description |
| :--- | :--- |
| `POST /customers/register` / `POST /customers/login` | Customer registration & JWT authentication |
| `GET /products` / `GET /products/:id` | Catalogue listing with category/search/sort & enriched `genuineRating` + `knownTradeOffs` |
| `GET /cart` / `POST /cart/:productId` / `PATCH /cart/:productId` | Persisted cart management with automatic `cartHash` discount revalidation |
| `DELETE /cart/discount/offer` | Manually remove an active negotiated discount code from the cart |
| `POST /api/ai/smart-shop/plan` | Generate a non-destructive **Shop by Goal** bundle (`temporaryProposal: true`) |
| `POST /api/ai/smart-shop/apply` | Explicitly add user-selected bundle items and quantities to the persisted cart |
| `POST /api/ai/smart-cart/review` | Run **Check My Cart** & **Smart Purchase Check** on persisted cart items |
| `POST /api/ai/smart-cart/replace` | **Swap for this**: replace a flagged cart product with an in-stock alternative preserving quantity |
| `POST /api/ai/smart-cart/negotiate` | **Ask for a Discount**: negotiate a bundle discount (server-capped at $\le 15\%$, bound to `cartHash`) |
| `POST /orders/create-payment-order` | Revalidate server-side cart total & discount, create live Razorpay order in paise |
| `POST /orders/verify-payment` | Verify Razorpay `HMAC-SHA256` signature, decrement stock, clear cart, and place order |
| `GET /reviews/product/:productId` / `POST /reviews/product/:productId` | Fetch separated reviews (`VERIFIED_PURCHASE`, `CUSTOMER_REVIEW`, `DEMO`) & submit buyer reviews |

---

## Local Setup & Environment Variables

### 1. Clone & Install

```bash
git clone https://github.com/Ramu-9/SmartKart.git
cd SmartKart
npm install
```

### 2. Configure Environment (`.env`)

Copy `.env.example` to `.env`. SmartKart is engineered with **graceful fallbacks**: if `MONGODB_URI`, `GEMINI_API_KEY`, or `RAZORPAY_KEY_ID` are omitted, the server automatically activates its seeded 38-product in-memory store, deterministic commerce engine, and test-mode payment verification.

```env
PORT=3000
JWT_EXPIRES_IN=7d
JWT_SECRET=your_jwt_secret_key

# Optional: MongoDB Atlas URI (falls back to built-in 38-product in-memory store when omitted)
MONGODB_URI=

# Optional: Google Gemini API Key (falls back to deterministic rule engine when omitted)
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

# Optional: Razorpay Test Mode Credentials
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
```

### 3. Run the Application & Automated Tests

```bash
# Run the 11 end-to-end automated integration tests
npm test

# Build frontend and start the full-stack server on http://localhost:3000
npm run dev

# Optional: Seed MongoDB Atlas with idempotent upserts (blocked in production)
npm run seed
```

---

## Automated Verification Suite (`npm test`)

Running `npm test` executes `tests/smartkart2.test.js` (11 integration tests across 7 suites):
1. **Catalogue & Seed Integrity**: Verifies all 38 products across 6 categories and preserves original SKUs.
2. **Shop by Goal Non-Destructive Workflow**: Confirms temporary proposals stay within budget, extract multi-quantity requests, include at most 1 cross-sell item, validate real catalogue IDs, and **never** mutate the persisted cart until `/api/ai/smart-shop/apply` is called.
3. **Check My Cart Guardrail**: Confirms AI Cart Review rejects empty persisted carts even after generating a temporary bundle.
4. **Review Source Separation & Verified Badges**: Confirms `VERIFIED_PURCHASE` vs `CUSTOMER_REVIEW` assignment, blocks duplicate reviews (`409`), enforces owner-only edits (`403`), and excludes `DEMO` reviews from `genuineRating`.
5. **Smart Purchase Check & Product Swap**: Confirms cautionary items are flagged with in-stock alternatives, zero-review products synthesize spec-based reviews (never returning `INSUFFICIENT DATA`), and swapping preserves item quantity.
6. **Discount Cap (15%), Cart-Hash Invalidation & Razorpay HMAC**: Confirms $>15\%$ requests are capped at $15\%$, cart mutations clear active discounts, Razorpay orders use exact paise (`finalTotal * 100`), invalid signatures fail (`400`) without clearing the cart, and valid `HMAC-SHA256` signatures complete the order.
