const mongoose = require('mongoose');
const Product = require('../models/product.model');
const ProductReview = require('../models/productReview.model');
const { CATALOGUE_PRODUCTS, DEMO_REVIEWS } = require('../data/catalogueData');

let activeStorageMode = null; // 'mongodb' | 'memory'
let storageInitPromise = null;

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
  if (raw === 'mongodb' || raw === 'memory' || raw === 'auto') {
    return raw;
  }
  return 'auto';
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

      if (process.env.NODE_ENV === 'test' && requested !== 'mongodb') {
        activeStorageMode = 'memory';
        return activeStorageMode;
      }

      if (requested === 'memory') {
        activeStorageMode = 'memory';
        console.log('Storage mode explicitly set to in-memory store (38 products & 17 demo reviews loaded)');
        return activeStorageMode;
      }

      const mongoUri = process.env.MONGODB_URI;
      if (!isValidMongoUri(mongoUri)) {
        if (requested === 'mongodb') {
          throw new Error(
            'FATAL: STORAGE_MODE=mongodb requires a valid MONGODB_URI environment variable.'
          );
        }
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
        if (requested === 'mongodb') {
          throw new Error(`FATAL: Failed to connect to MongoDB (STORAGE_MODE=mongodb): ${err.message}`);
        }
        activeStorageMode = 'memory';
        console.log('MongoDB unreachable — locked to built-in in-memory store');
        return activeStorageMode;
      }
    } finally {
      storageInitPromise = null;
    }
  })();

  return storageInitPromise;
}

function isMongoStorage() {
  if (activeStorageMode === 'mongodb') {
    return mongoose.connection.readyState === 1;
  }
  if (activeStorageMode === 'memory') {
    return false;
  }
  return mongoose.connection.readyState === 1;
}

function getActiveStorageMode() {
  return activeStorageMode || (mongoose.connection.readyState === 1 ? 'mongodb' : 'memory');
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
  getActiveStorageMode,
  setActiveStorageModeForTest
};
