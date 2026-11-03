const mongoose = require('mongoose');

const productReviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
      index: true
    },
    authorName: {
      type: String,
      required: true,
      trim: true,
      default: 'Customer'
    },
    rating: {
      type: Number,
      required: true,
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5']
    },
    title: {
      type: String,
      required: [true, 'Review title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters']
    },
    text: {
      type: String,
      required: [true, 'Review text is required'],
      trim: true,
      maxlength: [2000, 'Review text cannot exceed 2000 characters']
    },
    source: {
      type: String,
      enum: ['VERIFIED_PURCHASE', 'CUSTOMER_REVIEW', 'DEMO'],
      required: true
    },
    verifiedPurchase: {
      type: Boolean,
      default: false
    },
    moderationStatus: {
      type: String,
      enum: ['APPROVED', 'FLAGGED'],
      default: 'APPROVED'
    }
  },
  { timestamps: true }
);

// Prevent duplicate customer reviews per product (sparse/partial so DEMO reviews with customer: null can coexist)
productReviewSchema.index(
  { product: 1, customer: 1 },
  {
    unique: true,
    partialFilterExpression: { customer: { $type: 'objectId' } }
  }
);

module.exports = mongoose.model('ProductReview', productReviewSchema);
