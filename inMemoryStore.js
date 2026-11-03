const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { CATALOGUE_PRODUCTS, DEMO_REVIEWS } = require('./data/catalogueData');

const demoUserId = '507f191e810c19729de86001';
const demoPasswordHash = bcrypt.hashSync('password123', 10);

let products = CATALOGUE_PRODUCTS.map(p => ({ ...p }));
let reviews = DEMO_REVIEWS.map(r => ({ ...r }));
let customers = [
  {
    _id: demoUserId,
    fullName: 'Demo User',
    email: 'demo@smartkart.com',
    password: demoPasswordHash,
    phone: '9876543210',
    wishlist: ['507f191e810c19729de860eb'],
    cart: [
      {
        _id: '507f191e810c19729de86999',
        product: '507f191e810c19729de860ea',
        quantity: 1
      }
    ],
    activeDiscountOffer: null
  }
];
let orders = [];

function generateObjectId() {
  const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
  const random = crypto.randomBytes(8).toString('hex');
  return (timestamp + random).substring(0, 24);
}

function computeCartHash(cartItems) {
  if (!Array.isArray(cartItems) || cartItems.length === 0) return 'empty';
  const normalized = cartItems
    .map(item => {
      const pid = (item.product?._id || item.product || '').toString();
      const qty = Number(item.quantity || 0);
      return `${pid}:${qty}`;
    })
    .filter(s => !s.startsWith(':'))
    .sort()
    .join('|');
  return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 24);
}

function populateCartItem(item) {
  const prodId = typeof item.product === 'object' && item.product !== null ? item.product._id : item.product;
  const prod = products.find(p => p._id.toString() === prodId.toString());
  return {
    _id: item._id || generateObjectId(),
    product: prod ? {
      _id: prod._id,
      sku: prod.sku,
      name: prod.name,
      brand: prod.brand,
      price: prod.price,
      category: prod.category,
      image: prod.image,
      stock: prod.stock,
      description: prod.description,
      tags: prod.tags || [],
      useCase: prod.useCase || [],
      attributes: prod.attributes || {},
      discountEligible: prod.discountEligible !== false
    } : null,
    quantity: item.quantity
  };
}

module.exports = {
  generateObjectId,
  computeCartHash,

  resetForTests() {
    products = CATALOGUE_PRODUCTS.map(p => ({ ...p }));
    reviews = DEMO_REVIEWS.map(r => ({ ...r }));
    customers = [
      {
        _id: demoUserId,
        fullName: 'Demo User',
        email: 'demo@smartkart.com',
        password: demoPasswordHash,
        phone: '9876543210',
        wishlist: ['507f191e810c19729de860eb'],
        cart: [],
        activeDiscountOffer: null
      }
    ];
    orders = [];
  },

  // ================= PRODUCTS =================
  enrichProduct(p) {
    if (!p) return null;
    const { getProductKnownTradeOffs } = require('./services/fallback.service');
    const prodReviews = reviews.filter(
      r => r.product.toString() === p._id.toString() && r.moderationStatus === 'APPROVED'
    );
    const genuine = prodReviews.filter(
      r => r.source === 'VERIFIED_PURCHASE' || r.source === 'CUSTOMER_REVIEW'
    );
    const demo = prodReviews.filter(r => r.source === 'DEMO');
    const genuineRating =
      genuine.length > 0
        ? Number(
            (
              genuine.reduce((sum, r) => sum + Number(r.rating || 0), 0) /
              genuine.length
            ).toFixed(1)
          )
        : null;

    return Object.assign(p, {
      genuineRating,
      genuineReviewCount: genuine.length,
      demoReviewCount: demo.length,
      knownTradeOffs: getProductKnownTradeOffs(p)
    });
  },

  getAllProducts({ search, category, sort } = {}) {
    let result = products.map(p => this.enrichProduct(p));

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (Array.isArray(p.tags) && p.tags.some(t => t.toLowerCase().includes(q)))
      );
    }

    if (category && category !== 'All Categories') {
      result = result.filter(p => p.category.toLowerCase() === category.toLowerCase());
    }

    if (sort === 'price_asc') {
      result.sort((a, b) => a.price - b.price);
    } else if (sort === 'price_desc') {
      result.sort((a, b) => b.price - a.price);
    } else if (sort === 'rating_desc') {
      result.sort((a, b) => (b.genuineRating || 0) - (a.genuineRating || 0));
    } else {
      result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    return result;
  },

  getProductById(id) {
    if (!id) return null;
    const found = products.find(p => p._id.toString() === id.toString()) || null;
    return found ? this.enrichProduct(found) : null;
  },


  createProduct(data) {
    const newProd = {
      _id: generateObjectId(),
      sku: data.sku || `SK-CUST-${Date.now()}`,
      name: data.name,
      brand: data.brand || 'SmartKart',
      description: data.description,
      price: Number(data.price),
      category: data.category,
      image: data.image,
      stock: Number(data.stock || 0),
      tags: Array.isArray(data.tags) ? data.tags : [],
      useCase: Array.isArray(data.useCase) ? data.useCase : [],
      attributes: data.attributes || {},
      compatibility: Array.isArray(data.compatibility) ? data.compatibility : [],
      discountEligible: data.discountEligible !== false,
      createdAt: new Date()
    };
    products.push(newProd);
    return newProd;
  },

  updateProductStock(id, delta) {
    const prod = products.find(p => p._id.toString() === id.toString());
    if (prod) {
      prod.stock = Math.max(0, prod.stock + delta);
    }
    return prod;
  },

  // ================= CUSTOMERS =================
  getCustomerById(id) {
    if (!id) return null;
    return customers.find(c => c._id.toString() === id.toString()) || null;
  },

  findCustomerByEmail(email) {
    const norm = (email || '').trim().toLowerCase();
    return customers.find(c => c.email.toLowerCase() === norm) || null;
  },

  createCustomer({ fullName, email, password, phone }) {
    const newCust = {
      _id: generateObjectId(),
      fullName,
      email: email.trim().toLowerCase(),
      password,
      phone,
      wishlist: [],
      cart: [],
      activeDiscountOffer: null
    };
    customers.push(newCust);
    return newCust;
  },

  // ================= CART & DISCOUNT OFFERS =================
  invalidateDiscountIfCartChanged(user) {
    if (!user || !user.activeDiscountOffer) return;
    const currentHash = computeCartHash(user.cart || []);
    const now = new Date();
    const expired = user.activeDiscountOffer.expiresAt && new Date(user.activeDiscountOffer.expiresAt) < now;
    if (expired || user.activeDiscountOffer.cartHash !== currentHash) {
      user.activeDiscountOffer = null;
    }
  },

  getCart(userId) {
    const user = this.getCustomerById(userId);
    if (!user) return [];
    if (!user.cart) user.cart = [];
    this.invalidateDiscountIfCartChanged(user);
    return user.cart
      .map(item => populateCartItem(item))
      .filter(item => item.product != null);
  },

  getActiveDiscountOffer(userId) {
    const user = this.getCustomerById(userId);
    if (!user || !user.activeDiscountOffer) return null;
    this.invalidateDiscountIfCartChanged(user);
    return user.activeDiscountOffer || null;
  },

  setCustomerDiscountOffer(userId, offer) {
    const user = this.getCustomerById(userId);
    if (!user) return null;
    user.activeDiscountOffer = offer;
    return user.activeDiscountOffer;
  },

  addToCart(userId, productId, quantity = 1) {
    const user = this.getCustomerById(userId);
    if (!user) throw new Error('User not found');
    const product = this.getProductById(productId);
    if (!product) throw new Error('Product not found');
    if (product.stock <= 0) throw new Error('Product is out of stock');

    if (!user.cart) user.cart = [];

    const existingIndex = user.cart.findIndex(
      item => (item.product?._id || item.product).toString() === productId.toString()
    );

    if (existingIndex > -1) {
      const newQty = user.cart[existingIndex].quantity + quantity;
      if (newQty > product.stock) {
        throw new Error(`Requested quantity exceeds available stock (${product.stock} available)`);
      }
      user.cart[existingIndex].quantity = newQty;
    } else {
      if (quantity > product.stock) {
        throw new Error(`Requested quantity exceeds available stock (${product.stock} available)`);
      }
      user.cart.push({
        _id: generateObjectId(),
        product: productId.toString(),
        quantity
      });
    }

    this.invalidateDiscountIfCartChanged(user);
    return this.getCart(userId);
  },

  updateCartQuantity(userId, productId, quantity) {
    const user = this.getCustomerById(userId);
    if (!user) throw new Error('User not found');
    const product = this.getProductById(productId);
    if (!product) throw new Error('Product not found');
    if (quantity > product.stock) {
      throw new Error(`Quantity exceeds available stock (${product.stock} available)`);
    }

    if (!user.cart) user.cart = [];
    const item = user.cart.find(
      i => (i.product?._id || i.product).toString() === productId.toString()
    );
    if (!item) throw new Error('Product not in cart');

    item.quantity = quantity;
    this.invalidateDiscountIfCartChanged(user);
    return this.getCart(userId);
  },

  removeFromCart(userId, productId) {
    const user = this.getCustomerById(userId);
    if (!user) throw new Error('User not found');
    if (!user.cart) user.cart = [];

    const exists = user.cart.some(
      i => (i.product?._id || i.product).toString() === productId.toString()
    );
    if (!exists) throw new Error('Product not in cart');

    user.cart = user.cart.filter(
      i => (i.product?._id || i.product).toString() !== productId.toString()
    );
    this.invalidateDiscountIfCartChanged(user);
    return this.getCart(userId);
  },

  replaceCartItem(userId, oldProductId, newProductId, requestedQuantity) {
    const user = this.getCustomerById(userId);
    if (!user) throw new Error('User not found');
    if (!user.cart) user.cart = [];

    const oldIndex = user.cart.findIndex(
      i => (i.product?._id || i.product).toString() === oldProductId.toString()
    );
    if (oldIndex === -1) {
      throw new Error('Original product is not in your cart');
    }

    const newProduct = this.getProductById(newProductId);
    if (!newProduct) {
      throw new Error('Replacement product not found');
    }
    if (newProduct.stock <= 0) {
      throw new Error('Replacement product is out of stock');
    }

    const preservedQty = requestedQuantity || user.cart[oldIndex].quantity || 1;
    const existingNewIndex = user.cart.findIndex(
      (i, idx) => idx !== oldIndex && (i.product?._id || i.product).toString() === newProductId.toString()
    );

    const totalNeededQty = existingNewIndex > -1
      ? user.cart[existingNewIndex].quantity + preservedQty
      : preservedQty;

    if (totalNeededQty > newProduct.stock) {
      throw new Error(`Insufficient stock for ${newProduct.name} (${newProduct.stock} available)`);
    }

    if (existingNewIndex > -1) {
      user.cart[existingNewIndex].quantity = totalNeededQty;
      user.cart.splice(oldIndex, 1);
    } else {
      user.cart[oldIndex] = {
        _id: user.cart[oldIndex]._id || generateObjectId(),
        product: newProduct._id.toString(),
        quantity: preservedQty
      };
    }

    this.invalidateDiscountIfCartChanged(user);
    return this.getCart(userId);
  },

  clearCart(userId) {
    const user = this.getCustomerById(userId);
    if (user) {
      user.cart = [];
      user.activeDiscountOffer = null;
    }
  },

  // ================= WISHLIST =================
  getWishlist(userId) {
    const user = this.getCustomerById(userId);
    if (!user) return [];
    if (!user.wishlist) user.wishlist = [];

    return user.wishlist
      .map(id => products.find(p => p._id.toString() === id.toString()))
      .filter(Boolean)
      .map(p => ({
        _id: p._id,
        name: p.name,
        price: p.price,
        category: p.category,
        image: p.image,
        stock: p.stock
      }));
  },

  toggleWishlist(userId, productId) {
    const user = this.getCustomerById(userId);
    if (!user) throw new Error('User not found');
    const product = this.getProductById(productId);
    if (!product) throw new Error('Product not found');

    if (!user.wishlist) user.wishlist = [];
    const index = user.wishlist.findIndex(id => id.toString() === productId.toString());

    if (index > -1) {
      user.wishlist.splice(index, 1);
      return { saved: false, message: 'Product removed from wishlist' };
    } else {
      user.wishlist.push(productId);
      return { saved: true, message: 'Product added to wishlist' };
    }
  },

  addToWishlist(userId, productId) {
    const user = this.getCustomerById(userId);
    if (!user) throw new Error('User not found');
    if (!user.wishlist) user.wishlist = [];

    if (user.wishlist.some(id => id.toString() === productId.toString())) {
      throw new Error('Product already in wishlist');
    }
    user.wishlist.push(productId);
  },

  removeFromWishlist(userId, productId) {
    const user = this.getCustomerById(userId);
    if (!user) throw new Error('User not found');
    if (!user.wishlist) user.wishlist = [];

    const index = user.wishlist.findIndex(id => id.toString() === productId.toString());
    if (index === -1) {
      throw new Error('Product not in wishlist');
    }
    user.wishlist.splice(index, 1);
  },

  // ================= ORDERS =================
  createOrder(orderData) {
    const newOrder = {
      _id: generateObjectId(),
      ...orderData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    orders.push(newOrder);
    return newOrder;
  },

  getOrderById(id) {
    return orders.find(o => o._id.toString() === id.toString()) || null;
  },

  getOrderByPaymentId(paymentId) {
    if (!paymentId) return null;
    return (
      orders.find(
        o =>
          o.paymentStatus === 'PAID' &&
          ((o.razorpayPaymentId && o.razorpayPaymentId.toString() === paymentId.toString()) ||
            (o.paymentId && o.paymentId.toString() === paymentId.toString()))
      ) || null
    );
  },

  getOrdersByUser(userId) {
    return orders
      .filter(o => o.user.toString() === userId.toString())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  updateOrder(id, updates) {
    const order = this.getOrderById(id);
    if (!order) return null;
    Object.assign(order, updates, { updatedAt: new Date() });
    return order;
  },

  hasVerifiedPurchase(userId, productId) {
    if (!userId || !productId) return false;
    return orders.some(
      o =>
        o.user.toString() === userId.toString() &&
        o.paymentStatus === 'PAID' &&
        Array.isArray(o.items) &&
        o.items.some(item => (item.product?._id || item.product).toString() === productId.toString())
    );
  },

  // ================= PRODUCT REVIEWS =================
  getReviewsByProduct(productId) {
    return reviews
      .filter(r => r.product.toString() === productId.toString() && r.moderationStatus === 'APPROVED')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  getReviewById(reviewId) {
    return reviews.find(r => r._id.toString() === reviewId.toString()) || null;
  },

  findCustomerReview(productId, customerId) {
    if (!customerId) return null;
    return reviews.find(
      r =>
        r.product.toString() === productId.toString() &&
        r.customer &&
        r.customer.toString() === customerId.toString()
    ) || null;
  },

  createReview({ product, customer, authorName, rating, title, text, source, verifiedPurchase }) {
    const newReview = {
      _id: generateObjectId(),
      product: product.toString(),
      customer: customer ? customer.toString() : null,
      authorName: authorName || 'Customer',
      rating: Number(rating),
      title,
      text,
      source,
      verifiedPurchase: Boolean(verifiedPurchase),
      moderationStatus: 'APPROVED',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    reviews.push(newReview);
    return newReview;
  },

  updateReview(reviewId, { rating, title, text }) {
    const rev = this.getReviewById(reviewId);
    if (!rev) return null;
    if (rating !== undefined) rev.rating = Number(rating);
    if (title !== undefined) rev.title = title;
    if (text !== undefined) rev.text = text;
    rev.updatedAt = new Date();
    return rev;
  },

  deleteReview(reviewId) {
    const idx = reviews.findIndex(r => r._id.toString() === reviewId.toString());
    if (idx === -1) return false;
    reviews.splice(idx, 1);
    return true;
  }
};
