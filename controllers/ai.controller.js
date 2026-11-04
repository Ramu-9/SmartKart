const aiCommerceService = require('../services/aiCommerce.service');
const { isDatabaseUnavailableError } = require('../config/storageMode');

exports.createShoppingPlan = async (req, res) => {
  try {
    const { message } = req.body || {};
    const proposal = await aiCommerceService.generateShoppingProposal({
      message,
      user: req.user || null
    });

    res.status(200).json({
      success: true,
      proposal
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
      message: error.message || 'Unable to generate shopping proposal'
    });
  }
};

exports.applyShoppingProposal = async (req, res) => {
  try {
    const { items } = req.body || {};
    const result = await aiCommerceService.applyApprovedProposal({
      user: req.user,
      items
    });

    res.status(200).json({
      success: true,
      message: 'Approved products added to your cart',
      cart: result.cart,
      activeDiscountOffer: result.activeDiscountOffer
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
      message: error.message || 'Unable to apply selected items to cart'
    });
  }
};

exports.negotiateDiscount = async (req, res) => {
  try {
    const { message } = req.body || {};
    const result = await aiCommerceService.negotiateCartDiscount({
      user: req.user,
      message
    });

    res.status(200).json({
      success: true,
      ...result
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
      message: error.message || 'Unable to evaluate discount request'
    });
  }
};

exports.reviewCart = async (req, res) => {
  try {
    const { shoppingObjective } = req.body || {};
    const reviewResult = await aiCommerceService.reviewPersistedCart({
      user: req.user,
      shoppingObjective
    });

    res.status(200).json({
      success: true,
      review: reviewResult
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
      message: error.message || 'Unable to review your cart'
    });
  }
};

exports.replaceCartProduct = async (req, res) => {
  try {
    const { oldProductId, newProductId } = req.body || {};
    const result = await aiCommerceService.replaceProductInPersistedCart({
      user: req.user,
      oldProductId,
      newProductId
    });

    res.status(200).json({
      success: true,
      message: `Replaced with ${result.newProduct.name}`,
      cart: result.cart,
      activeDiscountOffer: result.activeDiscountOffer
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
      message: error.message || 'Unable to replace product in cart'
    });
  }
};
