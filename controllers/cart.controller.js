const Customer = require('../models/customer.model');
const Product = require('../models/product.model');

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
      const newQuantity = user.cart[existingItemIndex].quantity + 1;
      if (newQuantity > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Requested quantity exceeds available stock (${product.stock} available)`
        });
      }
      user.cart[existingItemIndex].quantity = newQuantity;
    } else {
      if (1 > product.stock) {
        return res.status(400).json({
          success: false,
          message: 'Requested quantity exceeds available stock'
        });
      }
      user.cart.push({ product: productId, quantity: 1 });
    }

    await user.save();

    await user.populate({
      path: 'cart.product',
      select: 'name price category image stock description'
    });

    res.status(200).json({
      success: true,
      message: 'Cart updated',
      cart: user.cart.filter(item => item.product != null)
    });
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getCart = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await Customer.findById(userId).populate({
      path: 'cart.product',
      select: 'name price category image stock description'
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const activeCart = (user.cart || []).filter(item => item.product != null);

    res.status(200).json({
      success: true,
      cart: activeCart
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
    await user.save();

    await user.populate({
      path: 'cart.product',
      select: 'name price category image stock description'
    });

    res.status(200).json({
      success: true,
      message: 'Cart updated',
      cart: user.cart.filter(item => item.product != null)
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
    await user.save();

    await user.populate({
      path: 'cart.product',
      select: 'name price category image stock description'
    });

    res.status(200).json({
      success: true,
      message: 'Product removed from cart',
      cart: user.cart.filter(item => item.product != null)
    });
  } catch (error) {
    console.error('Error removing from cart:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
