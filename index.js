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
    const isPlaceholderUri =
      k === 'MONGODB_URI' && typeof current === 'string' && /<[^>]+>/.test(current);
    if (!current || KNOWN_PLACEHOLDERS.has(current.trim()) || isPlaceholderUri) {
      process.env[k] = v;
    }
  }
  // If container runtime pre-injected STORAGE_MODE=mongodb alongside a template placeholder MONGODB_URI
  // in non-production development mode, honour .env's STORAGE_MODE=auto so dev server starts cleanly.
  if (
    process.env.NODE_ENV !== 'production' &&
    parsedEnv.STORAGE_MODE &&
    (!process.env.MONGODB_URI || /<[^>]+>/.test(process.env.MONGODB_URI))
  ) {
    process.env.STORAGE_MODE = parsedEnv.STORAGE_MODE;
  }
}

const express = require('express');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const { validateJwtConfigOnStartup } = require('./utils/jwtConfig');
const {
  initializeStorage,
  isMongoStorage,
  isMongoConnected,
  isDatabaseUnavailableError
} = require('./config/storageMode');

// Validate JWT configuration early
validateJwtConfigOnStartup();

// Mongoose fail-fast config
mongoose.set('bufferCommands', false);

const app = express();

// CORS configuration for same-origin and split frontend/backend deployments
app.use((req, res, next) => {
  const configuredOrigins = (process.env.CORS_ORIGIN || process.env.CLIENT_URL || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const requestOrigin = req.headers.origin;

  if (requestOrigin) {
    const allowOrigin =
      configuredOrigins.length === 0
        ? process.env.NODE_ENV !== 'production'
          ? requestOrigin
          : null
        : configuredOrigins.includes('*') || configuredOrigins.includes(requestOrigin)
        ? requestOrigin
        : null;

    if (allowOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowOrigin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

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

// Strict storage-mode availability guard: never allow MongoDB mode to fall back to in-memory on disconnect
app.use(
  ['/customers', '/products', '/wishlist', '/cart', '/orders', '/reviews', '/api/ai'],
  (req, res, next) => {
    if (isMongoStorage() && !isMongoConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Service temporarily unavailable (database offline)',
        error: 'Service temporarily unavailable (database offline)'
      });
    }
    next();
  }
);

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
  if (isDatabaseUnavailableError(err)) {
    console.warn('[SmartKart] Database operation failed:', err.message);
    return res.status(503).json({
      success: false,
      message: 'Service temporarily unavailable (database offline)',
      error: 'Service temporarily unavailable (database offline)'
    });
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

const resolvedPort =
  parsedEnv.PORT ||
  (process.env.PORT && process.env.PORT !== process.env.NGINX_PORT
    ? process.env.PORT
    : process.env.DEFAULT_APP_PORT) ||
  3000;
const PORT = Number(resolvedPort) || 3000;

async function startServer() {
  await initializeStorage();

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`SmartKart server running on http://0.0.0.0:${PORT}`);
  });

  const indexPath = path.join(frontendDist, 'index.html');
  if (!fs.existsSync(indexPath) && process.env.NODE_ENV !== 'test') {
    const { spawn } = require('child_process');
    const child = spawn('npm', ['run', 'build:frontend'], {
      cwd: __dirname,
      stdio: 'inherit',
      shell: true
    });
    child.on('error', (buildErr) => {
      console.warn('Frontend build check warning:', buildErr.message);
    });
  }

  return server;
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}

module.exports = app;