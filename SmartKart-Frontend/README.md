# SmartKart Frontend (`React 19 + Vite`)

This directory contains the React 19 Single Page Application for **SmartKart**.

## Key Directories

- `src/constants/uiStrings.js`: Centralized customer-facing UI labels & tooltips (`Shop by Goal`, `Your Suggested Bundle`, `Check My Cart`, `Smart Purchase Check`, `Ask for a Discount`, `Swap for this`).
- `src/context/CartContext.jsx`: Persisted cart state, `cartHash`-bound discount synchronization, and discount invalidation alerts.
- `src/context/ToastContext.jsx`: Accessible global toast notification system (`aria-live="polite"`).
- `src/components/`:
  - `Navbar.jsx`: Always-visible search bar, Catalogue, Shop by Goal, Wishlist, Cart badge, 1-click **Try Demo Account**, and mobile drawer.
  - `OnboardingTour.jsx`: 3-step first-visit interactive tooltip tour.
  - `CartAiReviewModal.jsx`: **Check My Cart** & **Smart Purchase Check** modal with `Great pick` / `Good fit` / `Worth a second look` badges and 1-click **Swap for this** product replacement.
  - `ProductReviewsSection.jsx`: Separated `VERIFIED_PURCHASE`, `CUSTOMER_REVIEW`, and collapsible `Sample reviews (not from real customers)`.
- `src/pages/`:
  - `Home.jsx`, `Products.jsx`, `ProductDetails.jsx`, `SmartShop.jsx`, `Cart.jsx`, `Checkout.jsx` (with live **Razorpay UPI QR Scanner**), `Orders.jsx`, `OrderDetails.jsx`, `OrderSuccess.jsx`, `Wishlist.jsx`, `Login.jsx`, `Register.jsx`.

See the root [`README.md`](../README.md) for full architecture, API documentation, and setup instructions.
