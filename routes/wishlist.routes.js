const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const wishlistController = require('../controllers/wishlist.controller');

router.get('/', authenticate, wishlistController.getWishlist);
router.post('/:productId', authenticate, wishlistController.addToWishlist);
router.delete('/:productId', authenticate, wishlistController.removeFromWishlist);
router.patch('/:productId/toggle', authenticate, wishlistController.toggleWishlist);

module.exports = router;
