const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.get('/product/:productId', reviewController.getProductReviews);
router.post('/product/:productId', authenticate, reviewController.createReview);
router.patch('/:reviewId', authenticate, reviewController.updateReview);
router.delete('/:reviewId', authenticate, reviewController.deleteReview);

module.exports = router;
