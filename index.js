if (process.env.NODE_ENV !== 'test') {
  require('dotenv').config({ override: true });
} else {
  require('dotenv').config();
}
const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const Product = require('./models/product.model');
const ProductReview = require('./models/productReview.model');
const { CATALOGUE_PRODUCTS, DEMO_REVIEWS } = require('./data/catalogueData');

const app = express();

app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());

// Simple in-memory rate limiter for AI endpoints
const aiRateWindowMs = 60 * 1000;
const aiMaxRequestsPerWindow = 60;
const aiRequestCounts = new Map();

function aiRateLimiter(req, res, next) {
  const key = req.ip || 'local';
  const now = Date.now();
  const entry = aiRequestCounts.get(key);
  if (!entry || now - entry.start > aiRateWindowMs) {
    aiRequestCounts.set(key, { start: now, count: 1 });
    return next();
  }
  entry.count += 1;
  if (entry.count > aiMaxRequestsPerWindow) {
    return res.status(429).json({
      success: false,
      message: 'Too many AI requests. Please wait a moment and try again.'
    });
  }
  next();
}

// Mongoose fail-fast config
mongoose.set('bufferCommands', false);

function isValidMongoUri(uri) {
  if (!uri || typeof uri !== 'string') return false;
  const trimmed = uri.trim();
  if (!trimmed.startsWith('mongodb://') && !trimmed.startsWith('mongodb+srv://')) {
    return false;
  }
  if (/<[^>]+>/.test(trimmed)) {
    return false;
  }
  const lower = trimmed.toLowerCase();
  const placeholderPatterns = [
    'cluster.mongodb.net',
    'your_mongodb',
    'your-mongodb',
    'example.com',
    'placeholder'
  ];
  return !placeholderPatterns.some(pattern => lower.includes(pattern));
}

async function ensureIdempotentCatalogueSeed() {
  if (process.env.NODE_ENV === 'production') return;
  try {
    for (const prod of CATALOGUE_PRODUCTS) {
      await Product.updateOne({ _id: prod._id }, { $set: prod }, { upsert: true });
    }
    for (const rev of DEMO_REVIEWS) {
      await ProductReview.updateOne({ _id: rev._id }, { $set: rev }, { upsert: true });
    }
  } catch (err) {
    console.log('Catalogue upsert skipped:', err.message);
  }
}

if (isValidMongoUri(process.env.MONGODB_URI) && process.env.NODE_ENV !== 'test') {
  mongoose.connect(process.env.MONGODB_URI.trim(), {
    serverSelectionTimeoutMS: 5000
  })
    .then(async () => {
      console.log('MongoDB connected');
      await ensureIdempotentCatalogueSeed();
    })
    .catch(() => {
      console.log('MongoDB unreachable — built-in in-memory store active');
    });
} else if (process.env.NODE_ENV !== 'test') {
  console.log('Using built-in in-memory store (38 products & 17 demo reviews loaded)');
}

const frontendDist = path.join(__dirname, 'SmartKart-Frontend', 'dist');

// Intercept browser HTML navigation before API routes for overlapping routes (/products, /cart, /smart-shop, etc.)
app.use((req, res, next) => {
  if (
    req.method === 'GET' &&
    !req.path.startsWith('/api/') &&
    !req.path.startsWith('/reviews/') &&
    req.headers.accept &&
    req.headers.accept.includes('text/html')
  ) {
    const indexPath = path.join(frontendDist, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }
  next();
});

// API routes
app.use('/customers', require('./routes/customer.routes'));
app.use('/products', require('./routes/product.routes'));
app.use('/wishlist', require('./routes/wishlist.routes'));
app.use('/cart', require('./routes/cart.routes'));
app.use('/orders', require('./routes/order.routes'));
app.use('/reviews', require('./routes/review.routes'));
app.use('/api/ai', aiRateLimiter, require('./routes/ai.routes'));

// Database offline graceful fallback error middleware
app.use((err, req, res, next) => {
  if (err.name === 'MongooseError' || err.name === 'MongoNetworkError' || (err.message && err.message.includes('buffering timed out'))) {
    console.warn('[AI Studio] Database offline — returning mock response');
    if (req.method === 'GET') {
      return res.json(req.path.endsWith('s') || req.path.endsWith('s/') ? [] : {});
    }
    return res.status(503).json({ error: 'Service temporarily unavailable (database offline)' });
  }
  next(err);
});

// Serve frontend assets
app.use(express.static(frontendDist));

// SPA catch-all fallback (Express 5 compatible)
app.use((req, res) => {
  const indexPath = path.join(frontendDist, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).send('SmartKart is starting up. Please wait for the frontend to build.');
  }
});

const PORT = 3000;
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SmartKart server running on http://0.0.0.0:${PORT}`);
  });
}

module.exports = app;