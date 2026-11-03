const mongoose = require('mongoose');
const ProductReview = require('../models/productReview.model');
const Product = require('../models/product.model');
const Order = require('../models/order.model');
const inMemoryStore = require('../inMemoryStore');

const isValidObjectId = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

function sanitizeText(str, maxLen = 2000) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<[^>]*>?/gm, '') // strip HTML tags
    .replace(/[\u0000-\u001F\u007F]/g, ' ') // strip control characters
    .trim()
    .slice(0, maxLen);
}

function calculateReviewStats(reviewsList) {
  const approved = (reviewsList || []).filter(r => r.moderationStatus !== 'FLAGGED');
  const genuineReviews = approved.filter(r => r.source === 'VERIFIED_PURCHASE' || r.source === 'CUSTOMER_REVIEW');
  const verifiedPurchaseReviews = approved.filter(r => r.source === 'VERIFIED_PURCHASE');
  const unverifiedCustomerReviews = approved.filter(r => r.source === 'CUSTOMER_REVIEW');
  const demoReviews = approved.filter(r => r.source === 'DEMO');

  const genuineRating = genuineReviews.length > 0
    ? Number((genuineReviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / genuineReviews.length).toFixed(1))
    : null;

  const demoRating = demoReviews.length > 0
    ? Number((demoReviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / demoReviews.length).toFixed(1))
    : null;

  return {
    genuineRating,
    genuineReviewCount: genuineReviews.length,
    verifiedPurchaseCount: verifiedPurchaseReviews.length,
    unverifiedCustomerCount: unverifiedCustomerReviews.length,
    demoReviewCount: demoReviews.length,
    demoRating,
    totalReviewCount: approved.length
  };
}

async function checkCustomerVerifiedPurchase(userId, productId) {
  if (!userId || !productId) return false;
  if (mongoose.connection.readyState === 1) {
    const paidOrder = await Order.findOne({
      user: userId,
      paymentStatus: 'PAID',
      'items.product': productId
    }).lean();
    return Boolean(paidOrder);
  }
  return inMemoryStore.hasVerifiedPurchase(userId, productId);
}

async function getProductReviews(productId) {
  if (!isValidObjectId(productId)) {
    const err = new Error('Invalid product ID');
    err.status = 400;
    throw err;
  }

  let reviews = [];
  if (mongoose.connection.readyState === 1) {
    reviews = await ProductReview.find({
      product: productId,
      moderationStatus: 'APPROVED'
    })
      .sort({ createdAt: -1 })
      .lean();
  } else {
    reviews = inMemoryStore.getReviewsByProduct(productId);
  }

  const stats = calculateReviewStats(reviews);
  return {
    reviews,
    stats
  };
}

async function createProductReview(user, productId, payload) {
  if (!user || !user._id) {
    const err = new Error('Authentication required');
    err.status = 401;
    throw err;
  }

  if (!isValidObjectId(productId)) {
    const err = new Error('Invalid product ID');
    err.status = 400;
    throw err;
  }

  // Verify product exists
  const product = mongoose.connection.readyState === 1
    ? await Product.findById(productId).lean()
    : inMemoryStore.getProductById(productId);

  if (!product) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }

  const rating = Number(payload?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    const err = new Error('Rating must be an integer between 1 and 5');
    err.status = 400;
    throw err;
  }

  const title = sanitizeText(payload?.title, 150);
  const text = sanitizeText(payload?.text, 2000);

  if (!title || title.length < 3) {
    const err = new Error('Review title must be at least 3 characters');
    err.status = 400;
    throw err;
  }

  if (!text || text.length < 5) {
    const err = new Error('Review text must be at least 5 characters');
    err.status = 400;
    throw err;
  }

  // Check duplicate review
  const existing = mongoose.connection.readyState === 1
    ? await ProductReview.findOne({ product: productId, customer: user._id }).lean()
    : inMemoryStore.findCustomerReview(productId, user._id);

  if (existing) {
    const err = new Error('You have already submitted a review for this product');
    err.status = 409;
    throw err;
  }

  // Determine verified purchase status strictly on backend
  const isVerified = await checkCustomerVerifiedPurchase(user._id, productId);
  const source = isVerified ? 'VERIFIED_PURCHASE' : 'CUSTOMER_REVIEW';

  let created;
  if (mongoose.connection.readyState === 1) {
    const doc = await ProductReview.create({
      product: productId,
      customer: user._id,
      authorName: user.fullName || 'Customer',
      rating,
      title,
      text,
      source,
      verifiedPurchase: isVerified,
      moderationStatus: 'APPROVED'
    });
    created = doc.toObject();
  } else {
    created = inMemoryStore.createReview({
      product: productId,
      customer: user._id,
      authorName: user.fullName || 'Customer',
      rating,
      title,
      text,
      source,
      verifiedPurchase: isVerified
    });
  }

  const updated = await getProductReviews(productId);
  return {
    review: created,
    stats: updated.stats
  };
}

async function updateProductReview(user, reviewId, payload) {
  if (!user || !user._id) {
    const err = new Error('Authentication required');
    err.status = 401;
    throw err;
  }

  if (!isValidObjectId(reviewId)) {
    const err = new Error('Invalid review ID');
    err.status = 400;
    throw err;
  }

  const existing = mongoose.connection.readyState === 1
    ? await ProductReview.findById(reviewId)
    : inMemoryStore.getReviewById(reviewId);

  if (!existing) {
    const err = new Error('Review not found');
    err.status = 404;
    throw err;
  }

  if (existing.source === 'DEMO' || !existing.customer || existing.customer.toString() !== user._id.toString()) {
    const err = new Error('You are not authorized to edit this review');
    err.status = 403;
    throw err;
  }

  const updates = {};
  if (payload?.rating !== undefined) {
    const rating = Number(payload.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      const err = new Error('Rating must be an integer between 1 and 5');
      err.status = 400;
      throw err;
    }
    updates.rating = rating;
  }

  if (payload?.title !== undefined) {
    const title = sanitizeText(payload.title, 150);
    if (!title || title.length < 3) {
      const err = new Error('Review title must be at least 3 characters');
      err.status = 400;
      throw err;
    }
    updates.title = title;
  }

  if (payload?.text !== undefined) {
    const text = sanitizeText(payload.text, 2000);
    if (!text || text.length < 5) {
      const err = new Error('Review text must be at least 5 characters');
      err.status = 400;
      throw err;
    }
    updates.text = text;
  }

  let updatedReview;
  if (mongoose.connection.readyState === 1) {
    Object.assign(existing, updates);
    await existing.save();
    updatedReview = existing.toObject();
  } else {
    updatedReview = inMemoryStore.updateReview(reviewId, updates);
  }

  const updated = await getProductReviews(existing.product.toString());
  return {
    review: updatedReview,
    stats: updated.stats
  };
}

async function deleteProductReview(user, reviewId) {
  if (!user || !user._id) {
    const err = new Error('Authentication required');
    err.status = 401;
    throw err;
  }

  if (!isValidObjectId(reviewId)) {
    const err = new Error('Invalid review ID');
    err.status = 400;
    throw err;
  }

  const existing = mongoose.connection.readyState === 1
    ? await ProductReview.findById(reviewId)
    : inMemoryStore.getReviewById(reviewId);

  if (!existing) {
    const err = new Error('Review not found');
    err.status = 404;
    throw err;
  }

  if (existing.source === 'DEMO' || !existing.customer || existing.customer.toString() !== user._id.toString()) {
    const err = new Error('You are not authorized to delete this review');
    err.status = 403;
    throw err;
  }

  const productId = existing.product.toString();

  if (mongoose.connection.readyState === 1) {
    await ProductReview.findByIdAndDelete(reviewId);
  } else {
    inMemoryStore.deleteReview(reviewId);
  }

  const updated = await getProductReviews(productId);
  return {
    deleted: true,
    stats: updated.stats
  };
}

module.exports = {
  sanitizeText,
  calculateReviewStats,
  checkCustomerVerifiedPurchase,
  getProductReviews,
  createProductReview,
  updateProductReview,
  deleteProductReview
};
