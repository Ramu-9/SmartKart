require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/product.model');
const ProductReview = require('./models/productReview.model');
const { CATALOGUE_PRODUCTS, DEMO_REVIEWS } = require('./data/catalogueData');

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

async function seedDatabase() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to run seed script in production environment.');
    process.exit(1);
  }

  if (!isValidMongoUri(process.env.MONGODB_URI)) {
    console.log('Valid MONGODB_URI is not set. In-memory store automatically loads the 38-product catalogue and demo reviews at runtime.');
    process.exit(0);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI.trim(), {
      serverSelectionTimeoutMS: 5000
    });
    console.log('MongoDB connected for idempotent seeding...');

    let productUpsertCount = 0;
    for (const prod of CATALOGUE_PRODUCTS) {
      await Product.updateOne(
        { _id: prod._id },
        { $set: prod },
        { upsert: true }
      );
      productUpsertCount++;
    }
    console.log(`Upserted ${productUpsertCount} catalogue products safely (no existing records deleted).`);

    let reviewUpsertCount = 0;
    for (const rev of DEMO_REVIEWS) {
      await ProductReview.updateOne(
        { _id: rev._id },
        { $set: rev },
        { upsert: true }
      );
      reviewUpsertCount++;
    }
    console.log(`Upserted ${reviewUpsertCount} DEMO reviews safely.`);

    await mongoose.connection.close();
    console.log('Idempotent seed completed successfully!');
  } catch (err) {
    console.error('Error seeding database:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
