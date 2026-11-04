const mongoose = require('mongoose');
const Product = require('../models/product.model');
const ProductReview = require('../models/productReview.model');
const { CATALOGUE_PRODUCTS, DEMO_REVIEWS } = require('../data/catalogueData');

// Fail fast on disconnected operations instead of buffering for 10 seconds
mongoose.set('bufferCommands', false);

let activeStorageMode = null; // 'mongodb' | 'memory'
let storageInitPromise = null;
let connectionListenersAttached = false;

function attachConnectionListeners() {
  if (connectionListenersAttached) return;
  connectionListenersAttached = true;

  mongoose.connection.on('disconnected', () => {
    if (activeStorageMode === 'mongodb' && process.env.NODE_ENV !== 'test') {
      console.warn(
        '[SmartKart Storage] MongoDB disconnected — storage mode remains locked to "mongodb" (no in-memory fallback).'
      );
    }
  });

  mongoose.connection.on('reconnected', () => {
    if (activeStorageMode === 'mongodb' && process.env.NODE_ENV !== 'test') {
      console.log('[SmartKart Storage] MongoDB reconnected — normal database operations resumed.');
    }
  });

  mongoose.connection.on('error', (err) => {
    if (activeStorageMode === 'mongodb' && process.env.NODE_ENV !== 'test') {
      console.warn('[SmartKart Storage] MongoDB connection error:', err.message);
    }
  });
}

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
  return !placeholderPatterns.some((pattern) => lower.includes(pattern));
}

function getRequestedStorageMode() {
  const raw = (process.env.STORAGE_MODE || 'auto').trim().toLowerCase();
  if (!raw) return 'auto';
  if (raw === 'mongodb' || raw === 'memory' || raw === 'auto') {
    return raw;
  }
  throw new Error(
    `FATAL: Invalid STORAGE_MODE "${process.env.STORAGE_MODE}". Allowed values: auto, mongodb, memory.`
  );
}

// Non-destructive seeding: only inserts missing catalogue items via $setOnInsert
async function ensureNonDestructiveCatalogueSeed() {
  if (process.env.NODE_ENV === 'production') return;
  try {
    for (const prod of CATALOGUE_PRODUCTS) {
      await Product.updateOne(
        { _id: prod._id },
        { $setOnInsert: prod },
        { upsert: true }
      );
    }
    for (const rev of DEMO_REVIEWS) {
      await ProductReview.updateOne(
        { _id: rev._id },
        { $setOnInsert: rev },
        { upsert: true }
      );
    }
  } catch (err) {
    console.log('Non-destructive catalogue seed skipped:', err.message);
  }
}

async function initializeStorage() {
  if (activeStorageMode) {
    return activeStorageMode;
  }
  if (storageInitPromise) {
    return storageInitPromise;
  }

  storageInitPromise = (async () => {
    try {
      const requested = getRequestedStorageMode();
      attachConnectionListeners();

      // Explicit mongodb mode: lock activeStorageMode to 'mongodb' immediately and never fall back to memory
      if (requested === 'mongodb') {
        activeStorageMode = 'mongodb';
        const mongoUri = process.env.MONGODB_URI;
        if (!isValidMongoUri(mongoUri)) {
          throw new Error(
            'FATAL: STORAGE_MODE=mongodb requires a valid MONGODB_URI environment variable.'
          );
        }
        try {
          if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(mongoUri.trim(), {
              serverSelectionTimeoutMS: 5000
            });
          }
          console.log('MongoDB connected (storage mode locked to mongodb)');
          await ensureNonDestructiveCatalogueSeed();
          return activeStorageMode;
        } catch (err) {
          throw new Error(`FATAL: Failed to connect to MongoDB (STORAGE_MODE=mongodb): ${err.message}`);
        }
      }

      if (process.env.NODE_ENV === 'test') {
        activeStorageMode = 'memory';
        return activeStorageMode;
      }

      if (requested === 'memory') {
        activeStorageMode = 'memory';
        console.log('Storage mode explicitly set to in-memory store (38 products & 17 demo reviews loaded)');
        return activeStorageMode;
      }

      // STORAGE_MODE=auto
      const mongoUri = process.env.MONGODB_URI;
      if (!isValidMongoUri(mongoUri)) {
        activeStorageMode = 'memory';
        console.log('Using built-in in-memory store (38 products & 17 demo reviews loaded)');
        return activeStorageMode;
      }

      try {
        await mongoose.connect(mongoUri.trim(), {
          serverSelectionTimeoutMS: 5000
        });
        activeStorageMode = 'mongodb';
        console.log('MongoDB connected (storage mode locked to mongodb)');
        await ensureNonDestructiveCatalogueSeed();
        return activeStorageMode;
      } catch (err) {
        activeStorageMode = 'memory';
        console.log('MongoDB unreachable at startup (STORAGE_MODE=auto) — locked to built-in in-memory store');
        return activeStorageMode;
      }
    } finally {
      storageInitPromise = null;
    }
  })();

  return storageInitPromise;
}

/**
 * Returns true if the application's selected/active storage mode is MongoDB,
 * independently of whether the MongoDB connection is currently healthy.
 * Never falls back to false when MongoDB disconnects.
 */
function isMongoStorage() {
  if (activeStorageMode === 'mongodb') {
    return true;
  }
  if (activeStorageMode === 'memory') {
    return false;
  }
  try {
    const requested = getRequestedStorageMode();
    if (requested === 'mongodb') {
      return true;
    }
    if (requested === 'memory') {
      return false;
    }
  } catch {
    return true;
  }
  return mongoose.connection.readyState === 1;
}

function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}

function getActiveStorageMode() {
  if (activeStorageMode) {
    return activeStorageMode;
  }
  try {
    const requested = getRequestedStorageMode();
    if (requested === 'mongodb' || requested === 'memory') {
      return requested;
    }
  } catch {
    return 'mongodb';
  }
  return mongoose.connection.readyState === 1 ? 'mongodb' : 'memory';
}

function createDatabaseUnavailableError(detail) {
  const err = new Error(
    detail || 'Service temporarily unavailable (database offline)'
  );
  err.status = 503;
  err.code = 'DATABASE_UNAVAILABLE';
  return err;
}

function assertMongoAvailable() {
  if (isMongoStorage() && !isMongoConnected()) {
    throw createDatabaseUnavailableError();
  }
}

function isDatabaseUnavailableError(err) {
  if (!err) return isMongoStorage() && !isMongoConnected();
  if (err.status === 503 || err.code === 'DATABASE_UNAVAILABLE') return true;
  if (isMongoStorage() && !isMongoConnected()) return true;
  const name = String(err.name || '');
  const msg = String(err.message || '');
  if (
    name === 'MongooseError' ||
    name === 'MongoNetworkError' ||
    name === 'MongoServerSelectionError' ||
    name === 'MongoNotConnectedError' ||
    name === 'MongoTopologyClosedError' ||
    msg.includes('buffering timed out') ||
    msg.includes('Client must be connected') ||
    msg.includes('Topology is closed')
  ) {
    return true;
  }
  return false;
}

function setActiveStorageModeForTest(mode) {
  activeStorageMode = mode;
  storageInitPromise = null;
}

module.exports = {
  isValidMongoUri,
  getRequestedStorageMode,
  ensureNonDestructiveCatalogueSeed,
  initializeStorage,
  isMongoStorage,
  isMongoConnected,
  getActiveStorageMode,
  createDatabaseUnavailableError,
  assertMongoAvailable,
  isDatabaseUnavailableError,
  setActiveStorageModeForTest
};
