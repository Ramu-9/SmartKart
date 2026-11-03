const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const cartController = require('../controllers/cart.controller');

router.get('/', authenticate, cartController.getCart);
router.delete('/discount/offer', authenticate, cartController.removeDiscount);
router.post('/:productId', authenticate, cartController.addToCart);
router.patch('/:productId', authenticate, cartController.updateQuantity);
router.delete('/:productId', authenticate, cartController.removeFromCart);

module.exports = router;

