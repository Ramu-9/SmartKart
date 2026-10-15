const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const orderController = require('../controllers/order.controller');

router.post('/create-payment-order', authenticate, orderController.createPaymentOrder);
router.post('/verify-payment', authenticate, orderController.verifyPayment);
router.get('/', authenticate, orderController.getOrders);
router.get('/:id', authenticate, orderController.getOrderById);
router.patch('/:id/status', authenticate, orderController.updateOrderStatus);

module.exports = router;
