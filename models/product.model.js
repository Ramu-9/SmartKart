const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  sku: {
    type: String,
    trim: true,
    sparse: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Product name is required']
  },
  brand: {
    type: String,
    default: 'SmartKart',
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Product description is required']
  },
  price: {
    type: Number,
    required: [true, 'Product price is required'],
    min: [0.01, 'Price must be greater than 0']
  },
  category: {
    type: String,
    required: [true, 'Product category is required'],
    index: true
  },
  image: {
    type: String,
    required: [true, 'Product image is required']
  },
  stock: {
    type: Number,
    required: [true, 'Product stock is required'],
    min: [0, 'Stock cannot be negative'],
    default: 0
  },
  tags: {
    type: [String],
    default: []
  },
  useCase: {
    type: [String],
    default: []
  },
  attributes: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  compatibility: {
    type: [String],
    default: []
  },
  discountEligible: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Product', productSchema);
