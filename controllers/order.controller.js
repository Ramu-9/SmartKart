const crypto = require('crypto');
const Order = require('../models/order.model');
const Customer = require('../models/customer.model');
const Product = require('../models/product.model');
const razorpay = require('../config/razorpay');
const inMemoryStore = require('../inMemoryStore');
const aiCommerceService = require('../services/aiCommerce.service');
const {
  isMongoStorage,
  assertMongoAvailable,
  isDatabaseUnavailableError
} = require('../config/storageMode');

const isValidObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

const isProductionEnv = () =>
  String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';

const hasLiveRazorpayKeys = () => {
  const keyId = String(process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || '').trim();
  if (!keyId || !keySecret) return false;
  const lowerId = keyId.toLowerCase();
  const lowerSecret = keySecret.toLowerCase();
  return (
    keyId !== 'rzp_test_placeholder' &&
    !lowerId.includes('your_razorpay') &&
    !lowerId.includes('placeholder') &&
    keySecret !== 'razorpay_secret_placeholder' &&
    !lowerSecret.includes('your_razorpay') &&
    !lowerSecret.includes('placeholder')
  );
};

/**
 * Simulated payments are strictly prohibited in production (NODE_ENV=production),
 * even if ALLOW_SIMULATED_PAYMENTS=true is set in environment variables.
 */
const isSimulationAllowed = () => {
  if (isProductionEnv()) {
    return false;
  }
  const raw = String(process.env.ALLOW_SIMULATED_PAYMENTS || '').trim().toLowerCase();
  if (raw === 'false' || raw === '0' || raw === 'no') {
    return false;
  }
  if (raw === 'true' || raw === '1' || raw === 'yes') {
    return true;
  }
  return process.env.NODE_ENV === 'test' || !hasLiveRazorpayKeys();
};

const verifyPaymentSignature = ({
  order,
  orderRazorpayId,
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature
}) => {
  if (!razorpay_order_id || String(razorpay_order_id) !== String(orderRazorpayId)) {
    return { valid: false, message: 'Razorpay order ID mismatch' };
  }

  if (!razorpay_signature || typeof razorpay_signature !== 'string') {
    return { valid: false, message: 'Invalid payment signature' };
  }

  const isSimulatedSignature = razorpay_signature === `sim_sig_${orderRazorpayId}`;
  const isSimulatedPaymentId = String(razorpay_payment_id || '').startsWith('pay_sim_');
  const isSimulatedOrder =
    String(orderRazorpayId || '').startsWith('order_sim_') ||
    order?.paymentMode === 'DEMO_SIMULATION';

  // 1. Handle simulated payment attempts
  if (isSimulatedSignature || isSimulatedPaymentId) {
    if (isProductionEnv()) {
      return {
        valid: false,
        message: 'Simulated payments are strictly disabled in production'
      };
    }

    if (!isSimulationAllowed()) {
      return {
        valid: false,
        message: 'Simulated payments are disabled in this environment'
      };
    }

    if (!isSimulatedSignature) {
      return {
        valid: false,
        message: 'Simulated payment ID cannot be verified with a live Razorpay signature'
      };
    }

    if (!isSimulatedOrder || (order?.paymentMode === 'RAZORPAY' && process.env.NODE_ENV !== 'test')) {
      return {
        valid: false,
        message: 'Simulated signature is not valid for a live Razorpay order'
      };
    }

    return {
      valid: true,
      isSimulated: true,
      paymentMode: 'DEMO_SIMULATION',
      paymentProvider: 'SIMULATED_DEMO'
    };
  }

  // 2. Live/Test Razorpay HMAC-SHA256 verification
  if (isProductionEnv() && isSimulatedOrder) {
    return {
      valid: false,
      message: 'Simulated demo orders cannot be verified as live Razorpay payments in production'
    };
  }

  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || '').trim();
  if (
    !keySecret ||
    keySecret === 'razorpay_secret_placeholder' ||
    keySecret.toLowerCase().includes('placeholder') ||
    keySecret.toLowerCase().includes('your_razorpay')
  ) {
    return { valid: false, message: 'Razorpay secret key is not configured for signature verification' };
  }

  const body = `${orderRazorpayId}|${razorpay_payment_id}`;
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(body)
    .digest('hex');

  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
  const receivedBuffer = Buffer.from(String(razorpay_signature), 'utf8');

  if (
    expectedBuffer.length !== receivedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    return { valid: false, message: 'Invalid payment signature' };
  }

  return {
    valid: true,
    isSimulated: false,
    paymentMode: 'RAZORPAY',
    paymentProvider: 'RAZORPAY'
  };
};

exports.createPaymentOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const { shippingAddress } = req.body || {};

    if (!shippingAddress) {
      return res.status(400).json({ success: false, message: 'Shipping address is required' });
    }

    const { fullName, phone, addressLine1, city, state, pincode } = shippingAddress;

    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ success: false, message: 'Full name is required' });
    }
    if (!phone || !phone.trim() || !/^\+?[0-9\s-]{10,15}$/.test(phone.trim())) {
      return res.status(400).json({ success: false, message: 'Valid phone number is required (at least 10 digits)' });
    }
    if (!addressLine1 || !addressLine1.trim()) {
      return res.status(400).json({ success: false, message: 'Address is required' });
    }
    if (!city || !city.trim()) {
      return res.status(400).json({ success: false, message: 'City is required' });
    }
    if (!state || !state.trim()) {
      return res.status(400).json({ success: false, message: 'State is required' });
    }
    if (!pincode || !/^[0-9]{6}$/.test(pincode.trim())) {
      return res.status(400).json({ success: false, message: 'Pincode must contain 6 digits' });
    }

    if (!isMongoStorage()) {
      const user = inMemoryStore.getCustomerById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const cart = inMemoryStore.getCart(userId);
      if (!cart || cart.length === 0) {
        return res.status(400).json({ success: false, message: 'Your cart is empty. Please add items to proceed.' });
      }

      const orderItems = [];
      let calculatedSubtotal = 0;

      for (const item of cart) {
        const prod = inMemoryStore.getProductById(item.product?._id || item.product);
        if (!prod) {
          return res.status(400).json({
            success: false,
            message: 'One or more products in your cart are no longer available'
          });
        }
        if (prod.stock < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${prod.name}. Only ${prod.stock} left in stock.`
          });
        }
        orderItems.push({
          product: prod._id,
          name: prod.name,
          price: prod.price,
          quantity: item.quantity,
          image: prod.image
        });
        calculatedSubtotal += prod.price * item.quantity;
      }

      if (calculatedSubtotal <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid order total' });
      }

      // Server-side revalidation of approved discount offer
      const discountValidation = await aiCommerceService.getValidatedCartDiscount(userId, cart);
      const finalAmountINR = discountValidation.finalTotal;
      const amountInPaise = Math.round(finalAmountINR * 100);
      let razorpayOrderId = 'order_sim_' + Math.random().toString(36).substring(2, 14);
      let isLiveRazorpayOrder = false;

      if (process.env.NODE_ENV !== 'test' && hasLiveRazorpayKeys()) {
        try {
          const rzpOrder = await razorpay.orders.create({
            amount: amountInPaise,
            currency: 'INR',
            receipt: 'rcpt_' + Date.now()
          });
          if (rzpOrder && rzpOrder.id) {
            razorpayOrderId = rzpOrder.id;
            isLiveRazorpayOrder = true;
          }
        } catch (rzpErr) {
          if (!isSimulationAllowed()) {
            return res.status(503).json({
              success: false,
              message: 'Payment gateway unavailable. Please try again later.'
            });
          }
          console.log(
            'Razorpay order creation fallback (non-production simulation):',
            rzpErr?.error?.description || rzpErr?.message || rzpErr
          );
        }
      } else if (!isSimulationAllowed()) {
        return res.status(503).json({
          success: false,
          message: 'Payment gateway is not configured for production.'
        });
      }

      const paymentMode = isLiveRazorpayOrder ? 'RAZORPAY' : 'DEMO_SIMULATION';
      const paymentProvider = isLiveRazorpayOrder ? 'RAZORPAY' : 'SIMULATED_DEMO';

      const order = inMemoryStore.createOrder({
        user: userId,
        items: orderItems,
        shippingAddress: {
          fullName: fullName.trim(),
          phone: phone.trim(),
          addressLine1: addressLine1.trim(),
          city: city.trim(),
          state: state.trim(),
          pincode: pincode.trim()
        },
        subtotalAmount: calculatedSubtotal,
        discountPercent: discountValidation.discountPercent,
        discountAmount: discountValidation.discountAmount,
        appliedOfferId: discountValidation.activeOffer?.offerId || null,
        totalAmount: finalAmountINR,
        paymentStatus: 'PENDING',
        paymentMode,
        paymentProvider,
        isSimulatedPayment: !isLiveRazorpayOrder,
        status: 'PENDING_PAYMENT',
        razorpayOrderId,
        razorpayPaymentId: null,
        simulatedPaymentId: null
      });

      return res.status(200).json({
        success: true,
        shopKartOrderId: order._id,
        razorpayOrderId,
        paymentMode,
        paymentProvider,
        isLiveRazorpayOrder,
        simulationMode: !isLiveRazorpayOrder,
        subtotalAmount: calculatedSubtotal,
        discountPercent: discountValidation.discountPercent,
        discountAmount: discountValidation.discountAmount,
        finalAmountINR,
        amount: amountInPaise,
        currency: 'INR',
        key: isLiveRazorpayOrder ? process.env.RAZORPAY_KEY_ID : null
      });
    }

    assertMongoAvailable();

    const user = await Customer.findById(userId).populate({
      path: 'cart.product',
      select: 'sku name brand price category image stock description discountEligible'
    });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.cart || user.cart.length === 0) {
      return res.status(400).json({ success: false, message: 'Your cart is empty. Please add items to proceed.' });
    }

    const orderItems = [];
    let calculatedSubtotal = 0;

    for (const item of user.cart) {
      const productId = item.product?._id || item.product;
      const product = await Product.findById(productId);

      if (!product) {
        return res.status(400).json({
          success: false,
          message: 'One or more products in your cart are no longer available'
        });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}. Only ${product.stock} left in stock.`
        });
      }

      orderItems.push({
        product: product._id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        image: product.image
      });

      calculatedSubtotal += product.price * item.quantity;
    }

    if (calculatedSubtotal <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid order total' });
    }

    const activeCart = user.cart.filter(item => item.product != null);
    const discountValidation = await aiCommerceService.getValidatedCartDiscount(userId, activeCart);
    const finalAmountINR = discountValidation.finalTotal;
    const amountInPaise = Math.round(finalAmountINR * 100);

    let razorpayOrderId = 'order_sim_' + Math.random().toString(36).substring(2, 14);
    let isLiveRazorpayOrder = false;

    if (process.env.NODE_ENV !== 'test' && hasLiveRazorpayKeys()) {
      try {
        const rzpOrder = await razorpay.orders.create({
          amount: amountInPaise,
          currency: 'INR',
          receipt: 'rcpt_' + Date.now()
        });
        if (rzpOrder && rzpOrder.id) {
          razorpayOrderId = rzpOrder.id;
          isLiveRazorpayOrder = true;
        }
      } catch (rzpErr) {
        if (!isSimulationAllowed()) {
          return res.status(503).json({
            success: false,
            message: 'Payment gateway unavailable. Please try again later.'
          });
        }
        console.warn(
          'Razorpay order creation fallback (non-production simulation):',
          rzpErr?.error?.description || rzpErr?.message || rzpErr
        );
      }
    } else if (!isSimulationAllowed()) {
      return res.status(503).json({
        success: false,
        message: 'Payment gateway is not configured for production.'
      });
    }

    const paymentMode = isLiveRazorpayOrder ? 'RAZORPAY' : 'DEMO_SIMULATION';
    const paymentProvider = isLiveRazorpayOrder ? 'RAZORPAY' : 'SIMULATED_DEMO';

    const shopKartOrder = new Order({
      user: userId,
      items: orderItems,
      shippingAddress: {
        fullName: fullName.trim(),
        phone: phone.trim(),
        addressLine1: addressLine1.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim()
      },
      subtotalAmount: calculatedSubtotal,
      discountPercent: discountValidation.discountPercent,
      discountAmount: discountValidation.discountAmount,
      appliedOfferId: discountValidation.activeOffer?.offerId || null,
      totalAmount: finalAmountINR,
      paymentStatus: 'PENDING',
      paymentMode,
      paymentProvider,
      isSimulatedPayment: !isLiveRazorpayOrder,
      status: 'PENDING_PAYMENT',
      razorpayOrderId,
      razorpayPaymentId: null,
      simulatedPaymentId: null
    });

    await shopKartOrder.save();

    res.status(200).json({
      success: true,
      shopKartOrderId: shopKartOrder._id,
      razorpayOrderId: razorpayOrderId,
      paymentMode,
      paymentProvider,
      isLiveRazorpayOrder,
      simulationMode: !isLiveRazorpayOrder,
      subtotalAmount: calculatedSubtotal,
      discountPercent: discountValidation.discountPercent,
      discountAmount: discountValidation.discountAmount,
      finalAmountINR,
      amount: amountInPaise,
      currency: 'INR',
      key: isLiveRazorpayOrder ? process.env.RAZORPAY_KEY_ID : null
    });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return res.status(503).json({
        success: false,
        message: 'Service temporarily unavailable (database offline)',
        error: 'Service temporarily unavailable (database offline)'
      });
    }
    console.error('Error creating payment order:', error);
    res.status(500).json({ success: false, message: 'Server error while creating order' });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const userId = req.user._id;
    const { shopKartOrderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

    if (!shopKartOrderId || !isValidObjectId(shopKartOrderId)) {
      return res.status(400).json({ success: false, message: 'Invalid ShopKart order ID' });
    }

    if (!razorpay_payment_id) {
      return res.status(400).json({ success: false, message: 'Missing Razorpay payment ID' });
    }

    if (!isMongoStorage()) {
      const order = inMemoryStore.getOrderById(shopKartOrderId);
      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }

      if (order.user.toString() !== userId.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      if (order.paymentStatus === 'PAID') {
        return res.status(409).json({
          success: false,
          message: 'Order has already been paid and verified'
        });
      }

      if (inMemoryStore.getOrderByPaymentId(razorpay_payment_id)) {
        return res.status(409).json({
          success: false,
          message: 'Payment ID has already been processed'
        });
      }

      const verification = verifyPaymentSignature({
        order,
        orderRazorpayId: order.razorpayOrderId,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      });

      if (!verification.valid) {
        inMemoryStore.updateOrder(shopKartOrderId, { paymentStatus: 'FAILED' });
        return res.status(400).json({
          success: false,
          message: verification.message || 'Invalid payment signature'
        });
      }

      // Re-verify stock availability before marking PAID or decrementing stock
      for (const item of order.items || []) {
        const prod = inMemoryStore.getProductById(item.product);
        if (!prod || prod.stock < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${item.name || 'product'}.`
          });
        }
      }

      const isSim = Boolean(verification.isSimulated);
      const updatedFields = {
        paymentStatus: 'PAID',
        status: 'PLACED',
        paymentMode: isSim ? 'DEMO_SIMULATION' : 'RAZORPAY',
        paymentProvider: isSim ? 'SIMULATED_DEMO' : 'RAZORPAY',
        isSimulatedPayment: isSim,
        razorpayPaymentId: isSim ? null : razorpay_payment_id,
        simulatedPaymentId: isSim ? razorpay_payment_id : null
      };
      if (req.body.shippingAddress && req.body.shippingAddress.fullName) {
        updatedFields.shippingAddress = {
          fullName: String(req.body.shippingAddress.fullName).trim(),
          phone: String(req.body.shippingAddress.phone || '').trim(),
          addressLine1: String(req.body.shippingAddress.addressLine1 || '').trim(),
          city: String(req.body.shippingAddress.city || '').trim(),
          state: String(req.body.shippingAddress.state || '').trim(),
          pincode: String(req.body.shippingAddress.pincode || '').trim()
        };
      }

      inMemoryStore.updateOrder(shopKartOrderId, updatedFields);

      for (const item of order.items) {
        inMemoryStore.updateProductStock(item.product, -item.quantity);
      }

      inMemoryStore.clearCart(userId);

      return res.status(200).json({
        success: true,
        message: isSim
          ? 'Simulated demo payment recorded (not processed or verified by Razorpay)'
          : 'Payment verified and order placed successfully',
        paymentMode: updatedFields.paymentMode,
        paymentProvider: updatedFields.paymentProvider,
        isSimulatedPayment: isSim,
        order: inMemoryStore.getOrderById(shopKartOrderId)
      });
    }

    assertMongoAvailable();

    const order = await Order.findOne({ _id: shopKartOrderId, user: userId });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.paymentStatus === 'PAID') {
      return res.status(409).json({
        success: false,
        message: 'Order has already been paid and verified'
      });
    }

    const existingPaidOrderWithPaymentId = await Order.findOne({
      $or: [
        { razorpayPaymentId: razorpay_payment_id },
        { simulatedPaymentId: razorpay_payment_id }
      ],
      paymentStatus: 'PAID'
    });
    if (existingPaidOrderWithPaymentId) {
      return res.status(409).json({
        success: false,
        message: 'Payment ID has already been processed'
      });
    }

    const verification = verifyPaymentSignature({
      order,
      orderRazorpayId: order.razorpayOrderId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    });

    if (!verification.valid) {
      order.paymentStatus = 'FAILED';
      await order.save();
      return res.status(400).json({
        success: false,
        message: verification.message || 'Invalid payment signature'
      });
    }

    // Re-verify stock availability for all items before marking order PAID
    for (const item of order.items || []) {
      const productDoc = await Product.findById(item.product);
      if (!productDoc || productDoc.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${item.name || 'product'}.`
        });
      }
    }

    const isSim = Boolean(verification.isSimulated);
    order.paymentStatus = 'PAID';
    order.status = 'PLACED';
    order.paymentMode = isSim ? 'DEMO_SIMULATION' : 'RAZORPAY';
    order.paymentProvider = isSim ? 'SIMULATED_DEMO' : 'RAZORPAY';
    order.isSimulatedPayment = isSim;
    order.razorpayPaymentId = isSim ? null : razorpay_payment_id;
    order.simulatedPaymentId = isSim ? razorpay_payment_id : null;
    await order.save();

    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.quantity }
      });
    }

    const user = await Customer.findById(userId);
    if (user) {
      user.cart = [];
      user.activeDiscountOffer = undefined;
      await user.save();
    }

    res.status(200).json({
      success: true,
      message: isSim
        ? 'Simulated demo payment recorded (not processed or verified by Razorpay)'
        : 'Payment verified and order placed successfully',
      paymentMode: order.paymentMode,
      paymentProvider: order.paymentProvider,
      isSimulatedPayment: isSim,
      order: order
    });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return res.status(503).json({
        success: false,
        message: 'Service temporarily unavailable (database offline)',
        error: 'Service temporarily unavailable (database offline)'
      });
    }
    console.error('Error verifying payment:', error);
    res.status(500).json({ success: false, message: 'Server error while verifying payment' });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const userId = req.user._id;

    if (!isMongoStorage()) {
      const orders = inMemoryStore.getOrdersByUser(userId);
      return res.status(200).json({
        success: true,
        orders: orders
      });
    }

    assertMongoAvailable();
    const orders = await Order.find({ user: userId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      orders: orders
    });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return res.status(503).json({
        success: false,
        message: 'Service temporarily unavailable (database offline)',
        error: 'Service temporarily unavailable (database offline)'
      });
    }
    console.error('Error fetching orders:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching orders' });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    if (!id || !isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID' });
    }

    if (!isMongoStorage()) {
      const order = inMemoryStore.getOrderById(id);
      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }

      if (order.user.toString() !== userId.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied. You do not own this order.' });
      }

      return res.status(200).json({
        success: true,
        order: order
      });
    }

    assertMongoAvailable();
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.user.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied. You do not own this order.' });
    }

    res.status(200).json({
      success: true,
      order: order
    });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return res.status(503).json({
        success: false,
        message: 'Service temporarily unavailable (database offline)',
        error: 'Service temporarily unavailable (database offline)'
      });
    }
    console.error('Error fetching order details:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching order details' });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!id || !isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID' });
    }

    const validStatuses = ['PENDING_PAYMENT', 'PLACED', 'CONFIRMED', 'SHIPPED', 'DELIVERED'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    if (!isMongoStorage()) {
      const order = inMemoryStore.updateOrder(id, { status });
      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
      return res.status(200).json({
        success: true,
        message: `Order status updated to ${status}`,
        order: order
      });
    }

    assertMongoAvailable();
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.status = status;
    await order.save();

    res.status(200).json({
      success: true,
      message: `Order status updated to ${status}`,
      order: order
    });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return res.status(503).json({
        success: false,
        message: 'Service temporarily unavailable (database offline)',
        error: 'Service temporarily unavailable (database offline)'
      });
    }
    console.error('Error updating order status:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
