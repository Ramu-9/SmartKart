const Customer = require('../models/customer.model');
const Product = require('../models/product.model');
const mongoose = require('mongoose');
const inMemoryStore = require('../inMemoryStore');

exports.addToWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id;

    if (!productId || !productId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    if (mongoose.connection.readyState !== 1) {
      try {
        inMemoryStore.addToWishlist(userId, productId);
        return res.status(200).json({ success: true, message: 'Product added to wishlist' });
      } catch (err) {
        if (err.message.includes('not found')) {
          return res.status(404).json({ success: false, message: err.message });
        }
        if (err.message.includes('already in wishlist')) {
          return res.status(409).json({ success: false, message: err.message });
        }
        return res.status(400).json({ success: false, message: err.message });
      }
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const user = await Customer.findById(userId);

    if (user.wishlist.includes(productId)) {
      return res.status(409).json({ success: false, message: 'Product already in wishlist' });
    }

    user.wishlist.push(productId);
    await user.save();

    res.status(200).json({ success: true, message: 'Product added to wishlist' });
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getWishlist = async (req, res) => {
  try {
    const userId = req.user._id;

    if (mongoose.connection.readyState !== 1) {
      const items = inMemoryStore.getWishlist(userId);
      return res.status(200).json({
        success: true,
        count: items.length,
        wishlist: items
      });
    }

    const user = await Customer.findById(userId).populate({
      path: 'wishlist',
      select: 'name price category image stock'
    });

    res.status(200).json({
      success: true,
      count: user.wishlist.length,
      wishlist: user.wishlist
    });
  } catch (error) {
    console.error('Error getting wishlist:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id;

    if (!productId || !productId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    if (mongoose.connection.readyState !== 1) {
      try {
        inMemoryStore.removeFromWishlist(userId, productId);
        return res.status(200).json({ success: true, message: 'Product removed from wishlist' });
      } catch (err) {
        if (err.message.includes('not in wishlist')) {
          return res.status(404).json({ success: false, message: err.message });
        }
        return res.status(400).json({ success: false, message: err.message });
      }
    }

    const user = await Customer.findById(userId);

    if (!user.wishlist.includes(productId)) {
      return res.status(404).json({ success: false, message: 'Product not in wishlist' });
    }

    user.wishlist = user.wishlist.filter(id => id.toString() !== productId);
    await user.save();

    res.status(200).json({ success: true, message: 'Product removed from wishlist' });
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.toggleWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id;

    if (!productId || !productId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    if (mongoose.connection.readyState !== 1) {
      try {
        const result = inMemoryStore.toggleWishlist(userId, productId);
        return res.status(200).json({ success: true, saved: result.saved, message: result.message });
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

    const user = await Customer.findById(userId);

    const isInWishlist = user.wishlist.includes(productId);

    if (isInWishlist) {
      user.wishlist = user.wishlist.filter(id => id.toString() !== productId);
      await user.save();
      return res.status(200).json({ success: true, saved: false, message: 'Product removed from wishlist' });
    } else {
      user.wishlist.push(productId);
      await user.save();
      return res.status(200).json({ success: true, saved: true, message: 'Product added to wishlist' });
    }
  } catch (error) {
    console.error('Error toggling wishlist:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
