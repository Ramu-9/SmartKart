const express = require('express');
const router = express.Router();
const aiController = require('../controllers/ai.controller');
const { authenticate, optionalAuthenticate } = require('../middlewares/auth.middleware');

// Temporary Vibe-to-Cart proposal (does NOT mutate actual cart)
router.post('/smart-shop/plan', optionalAuthenticate, aiController.createShoppingPlan);

// Explicit customer approval to merge items into persisted cart
router.post('/smart-shop/apply', authenticate, aiController.applyShoppingProposal);

// Dynamic price negotiation bound to persisted cart (max 15% cap)
router.post('/smart-cart/negotiate', authenticate, aiController.negotiateDiscount);

// SmartKart AI Review + Regret Shield + Alternative Discovery on persisted cart
router.post('/smart-cart/review', authenticate, aiController.reviewCart);

// Customer-confirmed product replacement in persisted cart
router.post('/smart-cart/replace', authenticate, aiController.replaceCartProduct);

module.exports = router;
