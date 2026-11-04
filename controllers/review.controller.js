const reviewService = require('../services/review.service');
const { isDatabaseUnavailableError } = require('../config/storageMode');

exports.getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const result = await reviewService.getProductReviews(productId);
    res.status(200).json({
      success: true,
      reviews: result.reviews,
      stats: result.stats
    });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return res.status(503).json({
        success: false,
        message: 'Service temporarily unavailable (database offline)',
        error: 'Service temporarily unavailable (database offline)'
      });
    }
    const status = error.status || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to fetch product reviews'
    });
  }
};

exports.createReview = async (req, res) => {
  try {
    const { productId } = req.params;
    const result = await reviewService.createProductReview(req.user, productId, req.body);
    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      review: result.review,
      stats: result.stats
    });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return res.status(503).json({
        success: false,
        message: 'Service temporarily unavailable (database offline)',
        error: 'Service temporarily unavailable (database offline)'
      });
    }
    const status = error.status || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to submit review'
    });
  }
};

exports.updateReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const result = await reviewService.updateProductReview(req.user, reviewId, req.body);
    res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      review: result.review,
      stats: result.stats
    });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return res.status(503).json({
        success: false,
        message: 'Service temporarily unavailable (database offline)',
        error: 'Service temporarily unavailable (database offline)'
      });
    }
    const status = error.status || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to update review'
    });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const result = await reviewService.deleteProductReview(req.user, reviewId);
    res.status(200).json({
      success: true,
      message: 'Review deleted successfully',
      stats: result.stats
    });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return res.status(503).json({
        success: false,
        message: 'Service temporarily unavailable (database offline)',
        error: 'Service temporarily unavailable (database offline)'
      });
    }
    const status = error.status || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to delete review'
    });
  }
};
