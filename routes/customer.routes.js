const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.post('/register', customerController.register);
router.post('/login', customerController.login);
router.get('/me', authenticate, customerController.getMe);
router.post('/logout', authenticate, customerController.logout);

module.exports = router;