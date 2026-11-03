const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  phone: { type: String, required: true, trim: true },
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  cart: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
      },
      quantity: {
        type: Number,
        default: 1,
        min: 1
      }
    }
  ],
  activeDiscountOffer: {
    offerId: { type: String },
    discountPercent: { type: Number, min: 0, max: 15, default: 0 },
    discountAmount: { type: Number, min: 0, default: 0 },
    cartHash: { type: String },
    reason: { type: String },
    expiresAt: { type: Date },
    createdAt: { type: Date }
  }
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);