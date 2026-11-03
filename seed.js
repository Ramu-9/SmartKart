require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/product.model');
const ProductReview = require('./models/productReview.model');
const { CATALOGUE_PRODUCTS, DEMO_REVIEWS } = require('./data/catalogueData');
const { isValidMongoUri } = require('./config/storageMode');

async function seedProductsAndReviewsNonDestructive(productModel = Product, reviewModel = ProductReview) {
  let productInsertCount = 0;
  for (const prod of CATALOGUE_PRODUCTS) {
    const res = await productModel.updateOne(
      { _id: prod._id },
      { $setOnInsert: prod },
      { upsert: true }
    );
    if (res && res.upsertedCount > 0) {
      productInsertCount++;
    }
  }

  let reviewInsertCount = 0;
  for (const rev of DEMO_REVIEWS) {
    const res = await reviewModel.updateOne(
      { _id: rev._id },
      { $setOnInsert: rev },
      { upsert: true }
    );
    if (res && res.upsertedCount > 0) {
      reviewInsertCount++;
    }
  }

  return { productInsertCount, reviewInsertCount };
}

async function seedDatabase() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to run seed script in production environment.');
    process.exit(1);
  }

  if (!isValidMongoUri(process.env.MONGODB_URI)) {
    console.log(
      'Valid MONGODB_URI is not set. In-memory store automatically loads the 38-product catalogue and demo reviews at runtime.'
    );
    process.exit(0);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI.trim(), {
      serverSelectionTimeoutMS: 5000
    });
    console.log('MongoDB connected for non-destructive seeding...');

    const { productInsertCount, reviewInsertCount } = await seedProductsAndReviewsNonDestructive();
    console.log(
      `Inserted ${productInsertCount} missing catalogue products and ${reviewInsertCount} missing DEMO reviews safely (existing records preserved untouched).`
    );

    await mongoose.connection.close();
    console.log('Non-destructive seed completed successfully!');
  } catch (err) {
    console.error('Error seeding database:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase, seedProductsAndReviewsNonDestructive };
