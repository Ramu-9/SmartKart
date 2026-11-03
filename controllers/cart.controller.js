const Customer = require('../models/customer.model');
const Product = require('../models/product.model');
const inMemoryStore = require('../inMemoryStore');
const aiCommerceService = require('../services/aiCommerce.service');
const { isMongoStorage } = require('../config/storageMode');

const getProductIdString = (productRef) => {
  if (!productRef) return '';
  if (productRef._id) return productRef._id.toString();
  return productRef.toString();
};

exports.addToCart = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id;

    if (!productId || !productId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    const requestedQty = req.body?.quantity !== undefined ? Number(req.body.quantity) : 1;
    const addQty = Number.isInteger(requestedQty) && requestedQty >= 1 ? requestedQty : 1;

    if (!isMongoStorage()) {
      try {
        const updatedCart = inMemoryStore.addToCart(userId, productId, addQty);
        const discountState = await aiCommerceService.getValidatedCartDiscount(userId, updatedCart);
        return res.status(200).json({
          success: true,
          message: 'Cart updated',
          cart: updatedCart,
          activeDiscountOffer: discountState.activeOffer
        });
      } catch (err) {
        if (err.message.includes('not found')) {
          return res.status(404).json({ success: false, message: err.message });
        }
        return res.status(400).json({ success: false, message: err.message });
      }
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (product.stock <= 0) {
      return res.status(400).json({ success: false, message: 'Product is out of stock' });
    }

    const user = await Customer.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.cart) {
      user.cart = [];
    }

    const existingItemIndex = user.cart.findIndex(
      item => getProductIdString(item.product) === productId
    );

    if (existingItemIndex > -1) {
      const newQuantity = user.cart[existingItemIndex].quantity + addQty;
      if (newQuantity > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Requested quantity exceeds available stock (${product.stock} available)`
        });
      }
      user.cart[existingItemIndex].quantity = newQuantity;
    } else {
      if (addQty > product.stock) {
        return res.status(400).json({
          success: false,
          message: 'Requested quantity exceeds available stock'
        });
      }
      user.cart.push({ product: productId, quantity: addQty });
    }

    user.activeDiscountOffer = undefined;
    await user.save();

    await user.populate({
      path: 'cart.product',
      select: 'sku name brand price category image stock description tags useCase attributes discountEligible'
    });

    const activeCart = user.cart.filter(item => item.product != null);
    res.status(200).json({
      success: true,
      message: 'Cart updated',
      cart: activeCart,
      activeDiscountOffer: null
    });
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getCart = async (req, res) => {
  try {
    const userId = req.user._id;

    if (!isMongoStorage()) {
      const activeCart = inMemoryStore.getCart(userId);
      const discountState = await aiCommerceService.getValidatedCartDiscount(userId, activeCart);
      return res.status(200).json({
        success: true,
        cart: activeCart,
        activeDiscountOffer: discountState.activeOffer
      });
    }

    const user = await Customer.findById(userId).populate({
      path: 'cart.product',
      select: 'sku name brand price category image stock description tags useCase attributes discountEligible'
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const activeCart = (user.cart || []).filter(item => item.product != null);
    const discountState = await aiCommerceService.getValidatedCartDiscount(userId, activeCart);

    res.status(200).json({
      success: true,
      cart: activeCart,
      activeDiscountOffer: discountState.activeOffer
    });
  } catch (error) {
    console.error('Error getting cart:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateQuantity = async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body || {};
    const userId = req.user._id;

    if (!productId || !productId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    if (quantity === undefined || quantity === null || typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be an integer greater than or equal to 1'
      });
    }

    if (!isMongoStorage()) {
      try {
        const updatedCart = inMemoryStore.updateCartQuantity(userId, productId, quantity);
        const discountState = await aiCommerceService.getValidatedCartDiscount(userId, updatedCart);
        return res.status(200).json({
          success: true,
          message: 'Cart updated',
          cart: updatedCart,
          activeDiscountOffer: discountState.activeOffer
        });
      } catch (err) {
        if (err.message.includes('not found') || err.message.includes('not in cart')) {
          return res.status(404).json({ success: false, message: err.message });
        }
        return res.status(400).json({ success: false, message: err.message });
      }
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const user = await Customer.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const cartItem = (user.cart || []).find(
      item => getProductIdString(item.product) === productId
    );

    if (!cartItem) {
      return res.status(404).json({ success: false, message: 'Product not in cart' });
    }

    if (quantity > product.stock) {
      return res.status(400).json({
        success: false,
        message: `Quantity exceeds available stock (${product.stock} available)`
      });
    }

    cartItem.quantity = quantity;
    user.activeDiscountOffer = undefined;
    await user.save();

    await user.populate({
      path: 'cart.product',
      select: 'sku name brand price category image stock description tags useCase attributes discountEligible'
    });

    res.status(200).json({
      success: true,
      message: 'Cart updated',
      cart: user.cart.filter(item => item.product != null),
      activeDiscountOffer: null
    });
  } catch (error) {
    console.error('Error updating cart quantity:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.removeFromCart = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id;

    if (!productId || !productId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    if (!isMongoStorage()) {
      try {
        const updatedCart = inMemoryStore.removeFromCart(userId, productId);
        const discountState = await aiCommerceService.getValidatedCartDiscount(userId, updatedCart);
        return res.status(200).json({
          success: true,
          message: 'Product removed from cart',
          cart: updatedCart,
          activeDiscountOffer: discountState.activeOffer
        });
      } catch (err) {
        if (err.message.includes('not found') || err.message.includes('not in cart')) {
          return res.status(404).json({ success: false, message: err.message });
        }
        return res.status(400).json({ success: false, message: err.message });
      }
    }

    const user = await Customer.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const itemExists = (user.cart || []).some(
      item => getProductIdString(item.product) === productId
    );

    if (!itemExists) {
      return res.status(404).json({ success: false, message: 'Product not in cart' });
    }

    user.cart = user.cart.filter(
      item => getProductIdString(item.product) !== productId
    );
    user.activeDiscountOffer = undefined;
    await user.save();

    await user.populate({
      path: 'cart.product',
      select: 'sku name brand price category image stock description tags useCase attributes discountEligible'
    });

    res.status(200).json({
      success: true,
      message: 'Product removed from cart',
      cart: user.cart.filter(item => item.product != null),
      activeDiscountOffer: null
    });
  } catch (error) {
    console.error('Error removing from cart:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.removeDiscount = async (req, res) => {
  try {
    const userId = req.user._id;
    if (!isMongoStorage()) {
      inMemoryStore.setCustomerDiscountOffer(userId, null);
      const activeCart = inMemoryStore.getCart(userId);
      return res.status(200).json({
        success: true,
        message: 'Discount removed',
        cart: activeCart,
        activeDiscountOffer: null
      });
    }

    const user = await Customer.findById(userId);
    if (user) {
      user.activeDiscountOffer = undefined;
      await user.save();
    }
    return res.status(200).json({
      success: true,
      message: 'Discount removed',
      activeDiscountOffer: null
    });
  } catch (error) {
    console.error('Error removing discount:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

