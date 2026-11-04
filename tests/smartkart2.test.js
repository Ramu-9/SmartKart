const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'smartkart-2-test-secret-key';
process.env.RAZORPAY_KEY_ID = 'rzp_test_smartkart2';
process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret_smartkart2';
process.env.GEMINI_API_KEY = '';

const app = require('../index');
const store = require('../inMemoryStore');
const geminiService = require('../services/gemini.service');

let server;
let baseUrl;

async function apiRequest(path, { method = 'GET', body, cookie } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const setCookie = response.headers.get('set-cookie');
  const data = await response.json().catch(() => ({}));
  return {
    status: response.status,
    data,
    cookie: setCookie ? setCookie.split(';')[0] : cookie
  };
}

async function registerAndLogin(emailPrefix = 'user') {
  const email = `${emailPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@test.com`;
  const password = 'Password123!';
  const regRes = await apiRequest('/customers/register', {
    method: 'POST',
    body: {
      fullName: `Test ${emailPrefix}`,
      email,
      password,
      phone: '9876543210'
    }
  });
  assert.equal(regRes.status, 201);

  const loginRes = await apiRequest('/customers/login', {
    method: 'POST',
    body: {
      email,
      password
    }
  });
  assert.equal(loginRes.status, 200);
  assert.ok(loginRes.cookie, 'Expected JWT auth cookie on login');
  return {
    cookie: loginRes.cookie,
    customer: regRes.data.customer
  };
}

describe('SmartKart 2.0 — Intelligent Commerce Platform Automated Test Suite', () => {
  before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    geminiService.setMockGenerator(null);
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  beforeEach(() => {
    store.resetForTests();
    geminiService.setMockGenerator(null);
  });

  describe('1. Expanded Product Catalogue & Seed Integrity', () => {
    test('returns 38 catalogue products across all 6 categories while preserving original 6 products', async () => {
      const res = await apiRequest('/products');
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.data.products));
      assert.equal(res.data.products.length, 38);

      const originalIds = [
        '507f191e810c19729de860ea',
        '507f191e810c19729de860eb',
        '507f191e810c19729de860ec',
        '507f191e810c19729de860ed',
        '507f191e810c19729de860ee',
        '507f191e810c19729de860ef'
      ];
      for (const id of originalIds) {
        const found = res.data.products.find((p) => String(p._id) === id);
        assert.ok(found, `Original product ${id} must be preserved`);
      }
    });
  });

  describe('2. Shopping Proposals (Vibe-to-Cart) & Explicit Approval Workflow', () => {
    test('generates a temporary shopping proposal within budget WITHOUT modifying the persisted cart', async () => {
      const { cookie } = await registerAndLogin('shopper');

      const planRes = await apiRequest('/api/ai/smart-shop/plan', {
        method: 'POST',
        cookie,
        body: {
          message: 'Hostel room setup under ₹15,000 with study lamp, chair, kettle, and desk'
        }
      });

      assert.equal(planRes.status, 200);
      const { proposal } = planRes.data;
      assert.equal(proposal.engine, 'FALLBACK_RULES');
      assert.ok(proposal.items.length > 0, 'Proposal should contain real catalogue items');
      assert.ok(proposal.estimatedSubtotal <= 15000, `Expected estimatedSubtotal ${proposal.estimatedSubtotal} <= 15000`);
      assert.equal(proposal.budget, 15000);
      assert.equal(proposal.budgetRemaining, 15000 - proposal.estimatedSubtotal);

      // Verify persisted cart is STILL empty
      const cartRes = await apiRequest('/cart', { cookie });
      assert.equal(cartRes.status, 200);
      assert.equal(cartRes.data.cart.length, 0, 'Generating a proposal must NEVER auto-add items to the persisted cart');
    });

    test('extracts explicit multiple quantities (e.g. "4 chairs under ₹25,000") and calculates subtotal = price * quantity', async () => {
      const planRes = await apiRequest('/api/ai/smart-shop/plan', {
        method: 'POST',
        body: {
          message: 'I need 4 chairs for our study room under ₹25,000'
        }
      });

      assert.equal(planRes.status, 200);
      const { proposal } = planRes.data;
      const chairItem = proposal.items.find((item) =>
        item.product.name.toLowerCase().includes('chair')
      );
      assert.ok(chairItem, 'Expected a chair in the proposal');
      assert.equal(chairItem.quantity, 4, 'Expected quantity of 4 for "4 chairs"');
      assert.ok(proposal.estimatedSubtotal >= chairItem.product.price * 4);
      assert.ok(proposal.estimatedSubtotal <= 25000, `Expected estimatedSubtotal ${proposal.estimatedSubtotal} <= 25000`);
    });

    test('includes at most one cross-sell suggestion that is NOT already in the proposal or persisted cart', async () => {
      const { cookie } = await registerAndLogin('crosssell');
      const planRes = await apiRequest('/api/ai/smart-shop/plan', {
        method: 'POST',
        cookie,
        body: {
          message: 'Gaming keyboard and mouse setup under ₹12,000'
        }
      });

      assert.equal(planRes.status, 200);
      const { proposal } = planRes.data;
      if (proposal.crossSell) {
        const proposalIds = new Set(proposal.items.map((i) => String(i.product._id)));
        assert.equal(
          proposalIds.has(String(proposal.crossSell.product._id)),
          false,
          'Cross-sell product must not duplicate a product already in the proposal'
        );
      }
    });

    test('supports Mocked Gemini AI mode for shopping proposal generation and validates real catalogue IDs', async () => {
      const allProducts = store.getAllProducts();
      const targetChair = allProducts.find((p) => p.name.toLowerCase().includes('chair') && p.price <= 4500);
      const targetLamp = allProducts.find((p) => p.name.toLowerCase().includes('lamp'));

      geminiService.setMockGenerator(async () => ({
        summary: 'Curated Study Setup via Gemini AI',
        tradeOffs: 'Selected 2 chairs and 1 study lamp within ₹12,000.',
        items: [
          {
            productId: String(targetChair._id),
            quantity: 2,
            reason: 'Two ergonomic mesh chairs for your study room.',
            limitations: 'Standard lumbar support.'
          },
          {
            productId: String(targetLamp._id),
            quantity: 1,
            reason: 'Eye-care study lamp.',
            limitations: 'USB rechargeable.'
          }
        ],
        crossSellProductId: '',
        crossSellReason: ''
      }));

      const planRes = await apiRequest('/api/ai/smart-shop/plan', {
        method: 'POST',
        body: { message: '2 chairs and a study lamp under ₹12,000' }
      });

      assert.equal(planRes.status, 200);
      assert.equal(planRes.data.proposal.engine, 'GEMINI_AI');
      assert.equal(planRes.data.proposal.items.length, 2);
      assert.equal(planRes.data.proposal.items[0].quantity, 2);
    });

    test('explicit approval (/api/ai/smart-shop/apply) adds approved items and quantities to the persisted cart', async () => {
      const { cookie } = await registerAndLogin('approver');

      const planRes = await apiRequest('/api/ai/smart-shop/plan', {
        method: 'POST',
        cookie,
        body: { message: '2 chairs under ₹12,000' }
      });
      const proposalItems = planRes.data.proposal.items;
      assert.ok(proposalItems.length >= 1);

      const applyRes = await apiRequest('/api/ai/smart-shop/apply', {
        method: 'POST',
        cookie,
        body: {
          items: proposalItems.map((item) => ({
            productId: item.product._id,
            quantity: item.quantity
          }))
        }
      });

      assert.equal(applyRes.status, 200);
      assert.ok(applyRes.data.cart.length >= 1);
      assert.equal(applyRes.data.cart[0].quantity, proposalItems[0].quantity);
    });
  });

  describe('3. Non-Negotiable AI Review Button Visibility & Empty Cart Rejection', () => {
    test('rejects AI Review when persisted cart is empty, even after generating a shopping proposal', async () => {
      const { cookie } = await registerAndLogin('emptycart');

      // Generate a temporary proposal first
      const planRes = await apiRequest('/api/ai/smart-shop/plan', {
        method: 'POST',
        cookie,
        body: { message: 'Gaming setup under ₹20,000' }
      });
      assert.equal(planRes.status, 200);
      assert.ok(planRes.data.proposal.items.length > 0);

      // Attempt AI Review while persisted cart is still empty -> MUST return 400
      const reviewRes = await apiRequest('/api/ai/smart-cart/review', {
        method: 'POST',
        cookie,
        body: { shoppingObjective: 'Gaming setup under ₹20,000' }
      });
      assert.equal(reviewRes.status, 400);
      assert.match(reviewRes.data.message, /AI Review is only available when your cart contains at least one product/i);
    });
  });

  describe('4. Customer Reviews, Verified Purchase Badges & Separated Rating Aggregation', () => {
    test('separates DEMO reviews from genuine customer ratings and enforces VERIFIED_PURCHASE vs CUSTOMER_REVIEW badges', async () => {
      const buyer = await registerAndLogin('verifiedbuyer');
      const regularUser = await registerAndLogin('unverifieduser');

      // Pick a product that has seeded DEMO reviews: HyperPulse X100 Budget Gaming Headset (507f191e810c19729de860f4)
      const productId = '507f191e810c19729de860f4';

      // Initial state: has DEMO reviews, 0 genuine reviews
      const initialRev = await apiRequest(`/reviews/product/${productId}`);
      assert.equal(initialRev.status, 200);
      assert.equal(initialRev.data.stats.genuineReviewCount, 0);
      assert.equal(initialRev.data.stats.genuineRating, null, 'DEMO reviews must NEVER count toward genuineRating');
      assert.ok(initialRev.data.stats.demoReviewCount >= 2);

      // Complete a paid order for `buyer` on this product
      const addCartRes = await apiRequest(`/cart/${productId}`, {
        method: 'POST',
        cookie: buyer.cookie,
        body: { quantity: 1 }
      });
      assert.equal(addCartRes.status, 200);

      const orderRes = await apiRequest('/orders/create-payment-order', {
        method: 'POST',
        cookie: buyer.cookie,
        body: {
          shippingAddress: {
            fullName: 'Verified Buyer',
            phone: '9876543210',
            addressLine1: '123 MG Road',
            city: 'Bengaluru',
            state: 'Karnataka',
            pincode: '560001'
          }
        }
      });
      assert.equal(orderRes.status, 200);

      const { shopKartOrderId, razorpayOrderId } = orderRes.data;
      const paymentId = 'pay_verified_test_1';
      const validSig = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpayOrderId}|${paymentId}`)
        .digest('hex');

      const verifyRes = await apiRequest('/orders/verify-payment', {
        method: 'POST',
        cookie: buyer.cookie,
        body: {
          shopKartOrderId,
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: validSig
        }
      });
      assert.equal(verifyRes.status, 200);

      // Buyer posts a review -> server must label it VERIFIED_PURCHASE
      const createBuyerRev = await apiRequest(`/reviews/product/${productId}`, {
        method: 'POST',
        cookie: buyer.cookie,
        body: {
          rating: 4,
          title: 'Decent for the price',
          text: 'Works fine for short calls after buying it.'
        }
      });
      assert.equal(createBuyerRev.status, 201);
      assert.equal(createBuyerRev.data.review.source, 'VERIFIED_PURCHASE');
      assert.equal(createBuyerRev.data.review.verifiedPurchase, true);

      // Duplicate review by same buyer must be rejected (409)
      const dupRes = await apiRequest(`/reviews/product/${productId}`, {
        method: 'POST',
        cookie: buyer.cookie,
        body: {
          rating: 5,
          title: 'Second review attempt',
          text: 'Should be blocked'
        }
      });
      assert.equal(dupRes.status, 409);

      // Unverified customer posts a review -> server must label it CUSTOMER_REVIEW
      const createUnverifiedRev = await apiRequest(`/reviews/product/${productId}`, {
        method: 'POST',
        cookie: regularUser.cookie,
        body: {
          rating: 2,
          title: 'Tried at a friend place',
          text: 'Clamping force is quite tight on the ears.'
        }
      });
      assert.equal(createUnverifiedRev.status, 201);
      assert.equal(createUnverifiedRev.data.review.source, 'CUSTOMER_REVIEW');
      assert.equal(createUnverifiedRev.data.review.verifiedPurchase, false);

      // Check aggregated stats: genuineRating must be average of 4 and 2 = 3.0 (excluding DEMO reviews)
      const afterRev = await apiRequest(`/reviews/product/${productId}`);
      assert.equal(afterRev.data.stats.genuineReviewCount, 2);
      assert.equal(afterRev.data.stats.genuineRating, 3);

      // Unauthorized edit by another user must fail with 403
      const reviewId = createBuyerRev.data.review._id;
      const forbiddenEdit = await apiRequest(`/reviews/${reviewId}`, {
        method: 'PATCH',
        cookie: regularUser.cookie,
        body: { rating: 1, title: 'Hacked', text: 'Unauthorized edit' }
      });
      assert.equal(forbiddenEdit.status, 403);

      // Owner can edit their own review
      const ownerEdit = await apiRequest(`/reviews/${reviewId}`, {
        method: 'PATCH',
        cookie: buyer.cookie,
        body: { rating: 5, title: 'Updated review', text: 'Updated after a week of usage.' }
      });
      assert.equal(ownerEdit.status, 200);
      assert.equal(ownerEdit.data.review.rating, 5);

      // Owner can delete their own review
      const ownerDelete = await apiRequest(`/reviews/${reviewId}`, {
        method: 'DELETE',
        cookie: buyer.cookie
      });
      assert.equal(ownerDelete.status, 200);
    });
  });

  describe('5. SmartKart AI Review, Regret Shield & Alternative Product Replacement', () => {
    test('flags CAUTION product in persisted cart, suggests real in-stock alternatives, and replaces product preserving quantity', async () => {
      const { cookie } = await registerAndLogin('reviewer');
      const cautionHeadsetId = '507f191e810c19729de860f4'; // HyperPulse X100 Budget Gaming Headset (seeded CAUTION reviews)

      // Add quantity 3 of the cautionary headset to persisted cart
      const addRes = await apiRequest(`/cart/${cautionHeadsetId}`, {
        method: 'POST',
        cookie,
        body: { quantity: 3 }
      });
      assert.equal(addRes.status, 200);

      const reviewRes = await apiRequest('/api/ai/smart-cart/review', {
        method: 'POST',
        cookie,
        body: { shoppingObjective: 'Comfortable gaming headset for long sessions' }
      });

      assert.equal(reviewRes.status, 200);
      const itemReview = reviewRes.data.review.items.find(
        (i) => String(i.productId) === cautionHeadsetId
      );
      assert.ok(itemReview);
      assert.equal(itemReview.category, 'CAUTION');
      assert.ok(itemReview.alternatives.length >= 1, 'Expected at least 1 better alternative from catalogue');

      const chosenAlt = itemReview.alternatives[0];
      assert.notEqual(String(chosenAlt._id), cautionHeadsetId);

      // Explicitly replace the caution product with the chosen alternative
      const replaceRes = await apiRequest('/api/ai/smart-cart/replace', {
        method: 'POST',
        cookie,
        body: {
          oldProductId: cautionHeadsetId,
          newProductId: chosenAlt._id
        }
      });

      assert.equal(replaceRes.status, 200);
      const updatedCart = replaceRes.data.cart;
      assert.equal(
        updatedCart.some((i) => String(i.product._id) === cautionHeadsetId),
        false,
        'Old cautionary product must be removed from cart'
      );
      const replacedEntry = updatedCart.find(
        (i) => String(i.product._id) === String(chosenAlt._id)
      );
      assert.ok(replacedEntry, 'New alternative product must be in persisted cart');
      assert.equal(replacedEntry.quantity, 3, 'Product replacement must preserve original quantity (3)');
    });

    test('synthesizes AI specification & value review when a cart product has 0 stored reviews (never returns INSUFFICIENT DATA)', async () => {
      const { cookie } = await registerAndLogin('aispec');
      const zeroReviewProductId = '507f191e810c19729de860ea'; // OnePlus 13 (0 seeded reviews)

      const addRes = await apiRequest(`/cart/${zeroReviewProductId}`, {
        method: 'POST',
        cookie,
        body: { quantity: 1 }
      });
      assert.equal(addRes.status, 200);

      const reviewRes = await apiRequest('/api/ai/smart-cart/review', {
        method: 'POST',
        cookie,
        body: { shoppingObjective: 'Flagship daily driver and mobile gaming' }
      });

      assert.equal(reviewRes.status, 200);
      assert.notEqual(reviewRes.data.review.overallCategory, 'INSUFFICIENT DATA');

      const itemReview = reviewRes.data.review.items.find(
        (i) => String(i.productId) === zeroReviewProductId
      );
      assert.ok(itemReview);
      assert.notEqual(itemReview.category, 'INSUFFICIENT DATA');
      assert.ok(itemReview.positiveThemes.length >= 2, 'Expected AI-synthesized positive themes from specs');
      assert.ok(itemReview.commonComplaints.length >= 1, 'Expected AI-synthesized trade-offs/considerations');
      assert.ok(itemReview.regretShieldFlags.length >= 1, 'Expected Regret Shield suitability check');
    });
  });

  describe('6. Dynamic Price Negotiation (15% Cap, Cart-Hash Binding) & Razorpay Payment Verification', () => {
    test('caps discount requests >15% at 15%, invalidates discount on cart change, and verifies Razorpay paise + HMAC signature', async () => {
      const { cookie } = await registerAndLogin('negotiator');
      const chairId = '507f191e810c19729de860fc'; // ErgoLite Mesh Study Chair (₹4,299)
      const lampId = '507f191e810c19729de86104'; // Lumio Study Lamp (₹1,199)

      // Add 2 items totaling > ₹5,000
      await apiRequest(`/cart/${chairId}`, {
        method: 'POST',
        cookie,
        body: { quantity: 1 }
      });
      await apiRequest(`/cart/${lampId}`, {
        method: 'POST',
        cookie,
        body: { quantity: 1 }
      });

      // Request a 30% discount -> must be strictly capped at <= 15%
      const negRes = await apiRequest('/api/ai/smart-cart/negotiate', {
        method: 'POST',
        cookie,
        body: {
          message: 'I am a college student buying a study bundle, can I please get 30% off?'
        }
      });

      assert.equal(negRes.status, 200);
      assert.equal(negRes.data.approved, true);
      assert.ok(
        negRes.data.discountPercent <= 15,
        `Discount percent ${negRes.data.discountPercent}% must never exceed 15%`
      );
      assert.ok(negRes.data.discountAmount > 0);

      // Mutate the cart (add another lamp) -> active discount offer must be automatically invalidated
      const mutatedCartRes = await apiRequest(`/cart/${lampId}`, {
        method: 'POST',
        cookie,
        body: { quantity: 1 }
      });
      assert.equal(mutatedCartRes.status, 200);
      assert.equal(
        mutatedCartRes.data.activeDiscountOffer,
        null,
        'Modifying the cart must invalidate the bound discount offer'
      );

      // Re-negotiate on the updated cart before checkout
      const renegotiateRes = await apiRequest('/api/ai/smart-cart/negotiate', {
        method: 'POST',
        cookie,
        body: {
          message: 'Student bundle discount 10% please'
        }
      });
      assert.equal(renegotiateRes.status, 200);
      assert.equal(renegotiateRes.data.approved, true);
      const expectedFinalTotal = renegotiateRes.data.finalTotal;

      // Create Razorpay payment order -> amount must equal expectedFinalTotal * 100 paise
      const paymentOrderRes = await apiRequest('/orders/create-payment-order', {
        method: 'POST',
        cookie,
        body: {
          shippingAddress: {
            fullName: 'Negotiator User',
            phone: '9876543210',
            addressLine1: '42 Residency Road',
            city: 'Bengaluru',
            state: 'Karnataka',
            pincode: '560025'
          }
        }
      });
      assert.equal(paymentOrderRes.status, 200);
      assert.equal(paymentOrderRes.data.amount, Math.round(expectedFinalTotal * 100));
      assert.equal(paymentOrderRes.data.finalAmountINR, expectedFinalTotal);

      const { shopKartOrderId, razorpayOrderId } = paymentOrderRes.data;

      // 1) Invalid signature must be rejected (400) and cart must NOT be cleared
      const badVerifyRes = await apiRequest('/orders/verify-payment', {
        method: 'POST',
        cookie,
        body: {
          shopKartOrderId,
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: 'pay_invalid_123',
          razorpay_signature: 'invalid_hmac_signature'
        }
      });
      assert.equal(badVerifyRes.status, 400);

      const cartAfterBadVerify = await apiRequest('/cart', { cookie });
      assert.ok(cartAfterBadVerify.data.cart.length > 0, 'Cart must remain intact when payment verification fails');

      // 2) Valid HMAC-SHA256 signature must succeed, decrement stock, and clear persisted cart
      const validPaymentId = 'pay_valid_999';
      const validSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpayOrderId}|${validPaymentId}`)
        .digest('hex');

      const goodVerifyRes = await apiRequest('/orders/verify-payment', {
        method: 'POST',
        cookie,
        body: {
          shopKartOrderId,
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: validPaymentId,
          razorpay_signature: validSignature
        }
      });
      assert.equal(goodVerifyRes.status, 200);
      assert.equal(goodVerifyRes.data.order.paymentStatus, 'PAID');
      assert.equal(goodVerifyRes.data.order.status, 'PLACED');

      const cartAfterGoodVerify = await apiRequest('/cart', { cookie });
      assert.equal(cartAfterGoodVerify.data.cart.length, 0, 'Persisted cart must be cleared after verified payment');
    });
  });

  describe('7. Surgical Engineering Hardening: Payment Security, Replay Protection & JWT Validation', () => {
    test('never leaks qrSignature or qrPaymentId from create-payment-order and blocks duplicate/replay payment verification (409) without double stock decrement', async () => {
      const { cookie } = await registerAndLogin('replayguard');
      const productId = '507f191e810c19729de860fd'; // Keychron K2 Wireless Mechanical Keyboard

      const beforeProd = await apiRequest(`/products/${productId}`);
      const initialStock = beforeProd.data.stock;

      await apiRequest(`/cart/${productId}`, {
        method: 'POST',
        cookie,
        body: { quantity: 1 }
      });

      const orderRes = await apiRequest('/orders/create-payment-order', {
        method: 'POST',
        cookie,
        body: {
          shippingAddress: {
            fullName: 'Security Tester',
            phone: '9876543210',
            addressLine1: '100 Cyber Park',
            city: 'Bengaluru',
            state: 'Karnataka',
            pincode: '560001'
          }
        }
      });

      assert.equal(orderRes.status, 200);
      assert.equal(orderRes.data.qrSignature, undefined, 'Server must never leak pre-computed HMAC signature to client');
      assert.equal(orderRes.data.qrPaymentId, undefined, 'Server must never leak pre-generated payment ID to client');

      const { shopKartOrderId, razorpayOrderId } = orderRes.data;

      // Mismatched razorpay_order_id must fail with 400
      const mismatchOrderRes = await apiRequest('/orders/verify-payment', {
        method: 'POST',
        cookie,
        body: {
          shopKartOrderId,
          razorpay_order_id: 'order_wrong_id_999',
          razorpay_payment_id: 'pay_unique_101',
          razorpay_signature: `sim_sig_${razorpayOrderId}`
        }
      });
      assert.equal(mismatchOrderRes.status, 400);

      // Valid first verification succeeds and decrements stock by 1
      const paymentId = 'pay_replay_test_501';
      const validSig = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpayOrderId}|${paymentId}`)
        .digest('hex');

      const firstVerify = await apiRequest('/orders/verify-payment', {
        method: 'POST',
        cookie,
        body: {
          shopKartOrderId,
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: validSig
        }
      });
      assert.equal(firstVerify.status, 200);

      const afterFirstProd = await apiRequest(`/products/${productId}`);
      assert.equal(afterFirstProd.data.stock, initialStock - 1, 'Stock must decrement exactly once');

      // Replaying the exact same verification request on an already PAID order must return 409 Conflict
      const replaySameOrder = await apiRequest('/orders/verify-payment', {
        method: 'POST',
        cookie,
        body: {
          shopKartOrderId,
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: validSig
        }
      });
      assert.equal(replaySameOrder.status, 409);

      const afterReplayProd = await apiRequest(`/products/${productId}`);
      assert.equal(afterReplayProd.data.stock, initialStock - 1, 'Stock must NOT decrement a second time on replay');

      // Creating a second order and attempting to reuse the already-processed paymentId must return 409 Conflict
      await apiRequest(`/cart/${productId}`, {
        method: 'POST',
        cookie,
        body: { quantity: 1 }
      });
      const secondOrderRes = await apiRequest('/orders/create-payment-order', {
        method: 'POST',
        cookie,
        body: {
          shippingAddress: {
            fullName: 'Security Tester',
            phone: '9876543210',
            addressLine1: '100 Cyber Park',
            city: 'Bengaluru',
            state: 'Karnataka',
            pincode: '560001'
          }
        }
      });
      assert.equal(secondOrderRes.status, 200);

      const secondOrderSigWithReusedPaymentId = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${secondOrderRes.data.razorpayOrderId}|${paymentId}`)
        .digest('hex');

      const reusePaymentIdRes = await apiRequest('/orders/verify-payment', {
        method: 'POST',
        cookie,
        body: {
          shopKartOrderId: secondOrderRes.data.shopKartOrderId,
          razorpay_order_id: secondOrderRes.data.razorpayOrderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: secondOrderSigWithReusedPaymentId
        }
      });
      assert.equal(reusePaymentIdRes.status, 409, 'Reusing an already processed razorpay_payment_id on another order must fail with 409');
    });

    test('rejects simulated payments even when ALLOW_SIMULATED_PAYMENTS=true in NODE_ENV=production, and enforces explicit DEMO_SIMULATION vs RAZORPAY separation', async () => {
      const { cookie } = await registerAndLogin('prodsim');
      const productId = '507f191e810c19729de860fe';

      await apiRequest(`/cart/${productId}`, {
        method: 'POST',
        cookie,
        body: { quantity: 1 }
      });

      const orderRes = await apiRequest('/orders/create-payment-order', {
        method: 'POST',
        cookie,
        body: {
          shippingAddress: {
            fullName: 'Prod Sim Tester',
            phone: '9876543210',
            addressLine1: '12 MG Road',
            city: 'Bengaluru',
            state: 'Karnataka',
            pincode: '560001'
          }
        }
      });
      assert.equal(orderRes.status, 200);
      assert.equal(orderRes.data.paymentMode, 'DEMO_SIMULATION');
      assert.equal(orderRes.data.paymentProvider, 'SIMULATED_DEMO');
      assert.equal(orderRes.data.simulationMode, true);
      const { shopKartOrderId, razorpayOrderId } = orderRes.data;

      const prevNodeEnv = process.env.NODE_ENV;
      const prevAllowSim = process.env.ALLOW_SIMULATED_PAYMENTS;
      try {
        // 1. Even with ALLOW_SIMULATED_PAYMENTS=true, NODE_ENV=production MUST block simulated verification
        process.env.NODE_ENV = 'production';
        process.env.ALLOW_SIMULATED_PAYMENTS = 'true';

        const simAttemptInProdWithFlag = await apiRequest('/orders/verify-payment', {
          method: 'POST',
          cookie,
          body: {
            shopKartOrderId,
            razorpay_order_id: razorpayOrderId,
            razorpay_payment_id: 'pay_sim_prod_attempt_1',
            razorpay_signature: `sim_sig_${razorpayOrderId}`
          }
        });
        assert.equal(
          simAttemptInProdWithFlag.status,
          400,
          'ALLOW_SIMULATED_PAYMENTS=true must NEVER bypass NODE_ENV=production payment safeguards'
        );

        // 2. Even if an attacker signs a DEMO_SIMULATION order_sim_* with HMAC in production, it must be rejected
        const forgedHmacForSimOrder = crypto
          .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
          .update(`${razorpayOrderId}|pay_live_attempt_on_sim_order`)
          .digest('hex');
        const hmacOnSimOrderInProd = await apiRequest('/orders/verify-payment', {
          method: 'POST',
          cookie,
          body: {
            shopKartOrderId,
            razorpay_order_id: razorpayOrderId,
            razorpay_payment_id: 'pay_live_attempt_on_sim_order',
            razorpay_signature: forgedHmacForSimOrder
          }
        });
        assert.equal(
          hmacOnSimOrderInProd.status,
          400,
          'Simulated demo orders cannot be verified as live Razorpay orders in production'
        );

        // 3. In non-production with ALLOW_SIMULATED_PAYMENTS=true, demo verification succeeds and explicitly labels DEMO_SIMULATION
        process.env.NODE_ENV = 'development';
        process.env.ALLOW_SIMULATED_PAYMENTS = 'true';

        const validDemoVerify = await apiRequest('/orders/verify-payment', {
          method: 'POST',
          cookie,
          body: {
            shopKartOrderId,
            razorpay_order_id: razorpayOrderId,
            razorpay_payment_id: 'pay_sim_dev_verified_1',
            razorpay_signature: `sim_sig_${razorpayOrderId}`
          }
        });
        assert.equal(validDemoVerify.status, 200);
        assert.equal(validDemoVerify.data.paymentMode, 'DEMO_SIMULATION');
        assert.equal(validDemoVerify.data.paymentProvider, 'SIMULATED_DEMO');
        assert.equal(validDemoVerify.data.isSimulatedPayment, true);
        assert.equal(validDemoVerify.data.order.paymentMode, 'DEMO_SIMULATION');
        assert.equal(validDemoVerify.data.order.paymentProvider, 'SIMULATED_DEMO');
        assert.equal(validDemoVerify.data.order.isSimulatedPayment, true);
        assert.equal(validDemoVerify.data.order.simulatedPaymentId, 'pay_sim_dev_verified_1');
        assert.equal(validDemoVerify.data.order.razorpayPaymentId, null, 'Demo order must never store a fake razorpayPaymentId');
      } finally {
        process.env.NODE_ENV = prevNodeEnv;
        if (prevAllowSim === undefined) {
          delete process.env.ALLOW_SIMULATED_PAYMENTS;
        } else {
          process.env.ALLOW_SIMULATED_PAYMENTS = prevAllowSim;
        }
      }
    });

    test('enforces secure JWT_SECRET in production and rejects missing or known fallback secrets', () => {
      const { getJwtSecret } = require('../utils/jwtConfig');
      const prevNodeEnv = process.env.NODE_ENV;
      const prevJwtSecret = process.env.JWT_SECRET;

      try {
        process.env.NODE_ENV = 'production';

        delete process.env.JWT_SECRET;
        assert.throws(
          () => getJwtSecret(),
          /FATAL: A strong JWT_SECRET/,
          'Missing JWT_SECRET must throw in production'
        );

        process.env.JWT_SECRET = 'smartkart_jwt_secret_dev_key_2026';
        assert.throws(
          () => getJwtSecret(),
          /FATAL: A strong JWT_SECRET/,
          'Public hardcoded fallback JWT_SECRET must be rejected in production'
        );

        process.env.JWT_SECRET = 'short_secret';
        assert.throws(
          () => getJwtSecret(),
          /FATAL: A strong JWT_SECRET/,
          'Short JWT_SECRET (<16 chars) must be rejected in production'
        );

        process.env.JWT_SECRET = 'prod_strong_random_jwt_secret_value_2026_secure';
        assert.equal(getJwtSecret(), 'prod_strong_random_jwt_secret_value_2026_secure');
      } finally {
        process.env.NODE_ENV = prevNodeEnv;
        if (prevJwtSecret === undefined) {
          delete process.env.JWT_SECRET;
        } else {
          process.env.JWT_SECRET = prevJwtSecret;
        }
      }
    });

    test('resolves explicit STORAGE_MODE deterministically, never falls back to memory when mongodb disconnects, and returns 503 when MongoDB is unavailable', async () => {
      const {
        initializeStorage,
        getActiveStorageMode,
        isMongoStorage,
        isMongoConnected,
        setActiveStorageModeForTest
      } = require('../config/storageMode');
      const prevStorageMode = process.env.STORAGE_MODE;
      const prevMongoUri = process.env.MONGODB_URI;

      try {
        setActiveStorageModeForTest(null);
        process.env.STORAGE_MODE = 'mongodb';
        delete process.env.MONGODB_URI;

        await assert.rejects(
          async () => await initializeStorage(),
          /FATAL: STORAGE_MODE=mongodb requires a valid MONGODB_URI/,
          'STORAGE_MODE=mongodb without MONGODB_URI must fail fast'
        );
        // Even after startup failure, STORAGE_MODE=mongodb must remain locked to mongodb
        assert.equal(getActiveStorageMode(), 'mongodb');
        assert.equal(isMongoStorage(), true, 'isMongoStorage() must remain true when STORAGE_MODE=mongodb even if disconnected');
        assert.equal(isMongoConnected(), false, 'isMongoConnected() must reflect that mongoose is not connected');

        // Verify that API requests while STORAGE_MODE=mongodb and MongoDB is disconnected fail safely with 503 Service Unavailable
        // and NEVER silently read or write from inMemoryStore
        const productsResWhenOffline = await apiRequest('/products');
        assert.equal(
          productsResWhenOffline.status,
          503,
          'GET /products must return 503 Service Unavailable when STORAGE_MODE=mongodb and MongoDB is disconnected'
        );
        assert.match(productsResWhenOffline.data.message, /Service temporarily unavailable/i);

        const aiPlanWhenOffline = await apiRequest('/api/ai/smart-shop/plan', {
          method: 'POST',
          body: { prompt: 'Home gym under 15000' }
        });
        assert.equal(
          aiPlanWhenOffline.status,
          503,
          'POST /api/ai/smart-shop/plan must return 503 when STORAGE_MODE=mongodb and MongoDB is disconnected'
        );

        // Verify invalid STORAGE_MODE fails fast
        setActiveStorageModeForTest(null);
        process.env.STORAGE_MODE = 'invalid_mode';
        await assert.rejects(
          async () => await initializeStorage(),
          /FATAL: Invalid STORAGE_MODE/,
          'Invalid STORAGE_MODE must throw a descriptive error'
        );

        setActiveStorageModeForTest(null);
        process.env.STORAGE_MODE = 'memory';
        const mode = await initializeStorage();
        assert.equal(mode, 'memory');
        assert.equal(getActiveStorageMode(), 'memory');
        assert.equal(isMongoStorage(), false);
      } finally {
        setActiveStorageModeForTest('memory');
        if (prevStorageMode === undefined) {
          delete process.env.STORAGE_MODE;
        } else {
          process.env.STORAGE_MODE = prevStorageMode;
        }
        if (prevMongoUri === undefined) {
          delete process.env.MONGODB_URI;
        } else {
          process.env.MONGODB_URI = prevMongoUri;
        }
      }
    });
  });
});



