const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load .env without blindly clobbering legitimate deployment env vars,
// while replacing known template placeholder strings if pre-injected by container runtimes.
const parsedEnv = dotenv.config().parsed || {};
const KNOWN_PLACEHOLDERS = new Set([
  'rzp_test_your_razorpay_key_id',
  'your_razorpay_key_secret',
  'rzp_test_placeholder',
  'razorpay_secret_placeholder',
  'smartkart_jwt_secret_dev_key_2026',
  'your_jwt_secret_key'
]);

if (process.env.NODE_ENV !== 'test') {
  for (const [k, v] of Object.entries(parsedEnv)) {
    const current = process.env[k];
    if (!current || KNOWN_PLACEHOLDERS.has(current.trim())) {
      process.env[k] = v;
    }
  }
}

const express = require('express');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const { validateJwtConfigOnStartup } = require('./utils/jwtConfig');
const { initializeStorage } = require('./config/storageMode');

// Validate JWT configuration early
validateJwtConfigOnStartup();

// Mongoose fail-fast config
mongoose.set('bufferCommands', false);

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
  if (
    err.name === 'MongooseError' ||
    err.name === 'MongoNetworkError' ||
    (err.message && err.message.includes('buffering timed out'))
  ) {
    console.warn('[SmartKart] Database operation failed:', err.message);
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

const PORT = Number(parsedEnv.PORT || process.env.PORT) || 3000;

async function startServer() {
  const indexPath = path.join(frontendDist, 'index.html');
  if (!fs.existsSync(indexPath) && process.env.NODE_ENV !== 'test') {
    try {
      const { execSync } = require('child_process');
      execSync('npm run build:frontend', { stdio: 'inherit', cwd: __dirname });
    } catch (buildErr) {
      console.warn('Frontend build check warning:', buildErr.message);
    }
  }
  await initializeStorage();
  return app.listen(PORT, '0.0.0.0', () => {
    console.log(`SmartKart server running on http://0.0.0.0:${PORT}`);
  });
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}

module.exports = app;