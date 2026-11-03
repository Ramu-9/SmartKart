const Product = require('../models/product.model');
const ProductReview = require('../models/productReview.model');
const mongoose = require('mongoose');
const inMemoryStore = require('../inMemoryStore');
const { getProductKnownTradeOffs } = require('../services/fallback.service');

exports.createProduct = async (req, res) => {
  try {
    const { name, description, price, category, image, stock } = req.body;

    if (mongoose.connection.readyState === 1) {
      const product = new Product({
        name,
        description,
        price,
        category,
        image,
        stock
      });
      const savedProduct = await product.save();
      return res.status(201).json(savedProduct);
    } else {
      const savedProduct = inMemoryStore.createProduct({
        name,
        description,
        price,
        category,
        image,
        stock
      });
      return res.status(201).json(savedProduct);
    }
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const { search, category, sort } = req.query;

    if (mongoose.connection.readyState === 1) {
      let query = {};
      if (search) {
        query.name = { $regex: search, $options: 'i' };
      }
      if (category && category !== 'All Categories') {
        query.category = category;
      }

      let sortQuery = {};
      if (sort === 'price_asc') {
        sortQuery.price = 1;
      } else if (sort === 'price_desc') {
        sortQuery.price = -1;
      } else {
        sortQuery.createdAt = -1;
      }

      const [productsDocs, allReviews] = await Promise.all([
        Product.find(query).sort(sortQuery).lean(),
        ProductReview.find({ moderationStatus: 'APPROVED' }).lean()
      ]);

      const reviewsByProd = {};
      for (const r of allReviews) {
        const pid = String(r.product);
        if (!reviewsByProd[pid]) reviewsByProd[pid] = [];
        reviewsByProd[pid].push(r);
      }

      const products = productsDocs.map((p) => {
        const list = reviewsByProd[String(p._id)] || [];
        const genuine = list.filter(
          (r) => r.source === 'VERIFIED_PURCHASE' || r.source === 'CUSTOMER_REVIEW'
        );
        const demo = list.filter((r) => r.source === 'DEMO');
        const genuineRating =
          genuine.length > 0
            ? Number(
                (
                  genuine.reduce((sum, r) => sum + Number(r.rating || 0), 0) /
                  genuine.length
                ).toFixed(1)
              )
            : null;
        return {
          ...p,
          genuineRating,
          genuineReviewCount: genuine.length,
          demoReviewCount: demo.length,
          knownTradeOffs: getProductKnownTradeOffs(p)
        };
      });

      if (sort === 'rating_desc') {
        products.sort((a, b) => (b.genuineRating || 0) - (a.genuineRating || 0));
      }

      return res.json({
        success: true,
        count: products.length,
        products
      });
    } else {
      const products = inMemoryStore.getAllProducts({ search, category, sort });
      return res.json({
        success: true,
        count: products.length,
        products
      });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getProductById = async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const productDoc = await Product.findById(req.params.id).lean();
      if (!productDoc) {
        return res.status(404).json({ message: 'Product not found' });
      }
      const list = await ProductReview.find({
        product: productDoc._id,
        moderationStatus: 'APPROVED'
      }).lean();
      const genuine = list.filter(
        (r) => r.source === 'VERIFIED_PURCHASE' || r.source === 'CUSTOMER_REVIEW'
      );
      const demo = list.filter((r) => r.source === 'DEMO');
      const genuineRating =
        genuine.length > 0
          ? Number(
              (
                genuine.reduce((sum, r) => sum + Number(r.rating || 0), 0) /
                genuine.length
              ).toFixed(1)
            )
          : null;

      return res.json({
        ...productDoc,
        genuineRating,
        genuineReviewCount: genuine.length,
        demoReviewCount: demo.length,
        knownTradeOffs: getProductKnownTradeOffs(productDoc)
      });
    } else {
      const product = inMemoryStore.getProductById(req.params.id);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      return res.json(product);
    }
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid product ID' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

