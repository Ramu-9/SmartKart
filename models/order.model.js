const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true
    },

    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true
        },
        name: {
          type: String,
          required: true
        },
        price: {
          type: Number,
          required: true
        },
        quantity: {
          type: Number,
          required: true
        },
        image: {
          type: String
        }
      }
    ],

    shippingAddress: {
      fullName: { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true },
      addressLine1: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      pincode: { type: String, required: true, trim: true }
    },

    subtotalAmount: {
      type: Number
    },

    discountPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 15
    },

    discountAmount: {
      type: Number,
      default: 0,
      min: 0
    },

    appliedOfferId: {
      type: String,
      default: null
    },

    totalAmount: {
      type: Number,
      required: true
    },

    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID', 'FAILED'],
      default: 'PENDING'
    },

    paymentMode: {
      type: String,
      enum: ['RAZORPAY', 'DEMO_SIMULATION'],
      default: 'RAZORPAY'
    },

    paymentProvider: {
      type: String,
      enum: ['RAZORPAY', 'SIMULATED_DEMO'],
      default: 'RAZORPAY'
    },

    isSimulatedPayment: {
      type: Boolean,
      default: false
    },

    status: {
      type: String,
      enum: ['PENDING_PAYMENT', 'PLACED', 'CONFIRMED', 'SHIPPED', 'DELIVERED'],
      default: 'PENDING_PAYMENT'
    },

    razorpayOrderId: {
      type: String
    },
    razorpayPaymentId: {
      type: String,
      default: null
    },
    simulatedPaymentId: {
      type: String,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
