const crypto = require('crypto');
const Product = require('../models/product.model');
const Customer = require('../models/customer.model');
const inMemoryStore = require('../inMemoryStore');
const geminiService = require('./gemini.service');
const fallbackService = require('./fallback.service');
const reviewService = require('./review.service');
const { isMongoStorage } = require('../config/storageMode');

const isValidObjectId = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

async function fetchAllCatalogueProducts() {
  if (isMongoStorage()) {
    return await Product.find({}).lean();
  }
  return inMemoryStore.getAllProducts();
}

async function fetchProductById(productId) {
  if (!isValidObjectId(productId)) return null;
  if (isMongoStorage()) {
    return await Product.findById(productId).lean();
  }
  return inMemoryStore.getProductById(productId);
}

async function fetchPersistedCartForUser(userId) {
  if (!userId) return [];
  if (isMongoStorage()) {
    const user = await Customer.findById(userId).populate({
      path: 'cart.product',
      select: 'sku name brand price category image stock description tags useCase attributes discountEligible'
    });
    if (!user) return [];
    return (user.cart || []).filter(item => item.product != null);
  }
  return inMemoryStore.getCart(userId);
}

//Bounded candidate retrieval for Gemini (max 20 most relevant in-stock products)
function selectBoundedCandidates(allProducts, intent, maxCount = 22) {
  const inStock = (allProducts || []).filter(p => p.stock > 0);
  if (inStock.length <= maxCount) return inStock;

  const scored = inStock.map(p => {
    let score = 0;
    const hay = `${p.name} ${p.brand || ''} ${p.category} ${p.description} ${(p.tags || []).join(' ')} ${(p.useCase || []).join(' ')}`.toLowerCase();
    if (Array.isArray(p.useCase) && p.useCase.includes(intent.objective)) {
      score += 5;
    }
    for (const kw of intent.keywords || []) {
      if (hay.includes(kw)) score += 3;
    }
    for (const slotKey of Object.keys(intent.explicitQuantities || {})) {
      if (hay.includes(slotKey)) score += 6;
    }
    if (intent.budget && p.price <= intent.budget) {
      score += 2;
    }
    return { product: p, score };
  });

  scored.sort((a, b) => b.score - a.score || a.product.price - b.product.price);
  return scored.slice(0, maxCount).map(s => s.product);
}

// 1. VIBE-TO-CART SHOPPING PROPOSAL (Never mutates actual cart)
async function generateShoppingProposal({ message, user }) {
  const cleanMessage = reviewService.sanitizeText(message, 600);
  if (!cleanMessage || cleanMessage.length < 2) {
    const err = new Error('Please describe what you are looking to shop for.');
    err.status = 400;
    throw err;
  }

  const allProducts = await fetchAllCatalogueProducts();
  let existingCartIds = [];
  if (user && user._id) {
    const cart = await fetchPersistedCartForUser(user._id);
    existingCartIds = cart.map(item => (item.product?._id || item.product).toString());
  }

  const intent = fallbackService.extractShoppingIntent(cleanMessage);
  const candidates = selectBoundedCandidates(allProducts, intent, 24);

  // Build deterministic baseline first
  const fallbackProposal = fallbackService.buildFallbackShoppingProposal(
    cleanMessage,
    candidates,
    allProducts,
    existingCartIds
  );

  if (!geminiService.isGeminiConfigured() || candidates.length === 0) {
    return fallbackProposal;
  }

  try {
    const { Type } = geminiService;
    const catalogueDigest = candidates.map(p => ({
      id: p._id.toString(),
      name: p.name,
      brand: p.brand || 'SmartKart',
      category: p.category,
      price: p.price,
      stock: p.stock,
      tags: p.tags || [],
      useCase: p.useCase || [],
      attributes: p.attributes || {}
    }));

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING },
        tradeOffs: { type: Type.STRING },
        items: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              productId: { type: Type.STRING },
              quantity: { type: Type.INTEGER },
              reason: { type: Type.STRING },
              limitations: { type: Type.STRING }
            },
            required: ['productId', 'quantity', 'reason', 'limitations']
          }
        },
        crossSellProductId: { type: Type.STRING },
        crossSellReason: { type: Type.STRING }
      },
      required: ['summary', 'tradeOffs', 'items']
    };

    const aiResult = await geminiService.generateStructuredJson({
      task: 'smart_shop_plan',
      systemInstruction:
        'You are SmartKart Intelligence, an authoritative e-commerce shopping architect. ' +
        'Select products strictly from the provided catalogue JSON. ' +
        'Never invent product IDs or prices. Respect the user budget and explicit quantity requests. ' +
        'Do not pad the basket with irrelevant items.',
      prompt: JSON.stringify({
        customerRequest: cleanMessage,
        extractedIntent: intent,
        existingCartProductIds: existingCartIds,
        availableCatalogue: catalogueDigest
      }),
      responseSchema
    });

    // Validate AI output against authoritative database records
    if (!aiResult || !Array.isArray(aiResult.items)) {
      throw new Error('Invalid AI proposal structure');
    }

    const validatedItems = [];
    const seenIds = new Set();
    let subtotal = 0;

    for (const rawItem of aiResult.items) {
      if (!rawItem || !rawItem.productId || seenIds.has(rawItem.productId)) continue;
      const dbProduct = allProducts.find(p => p._id.toString() === rawItem.productId && p.stock > 0);
      if (!dbProduct) continue;

      // Preserve explicit user quantity if requested for this slot
      let qty = Math.max(1, parseInt(rawItem.quantity, 10) || 1);
      for (const [slotKey, explicitQty] of Object.entries(intent.explicitQuantities || {})) {
        if ( `${dbProduct.name} ${(dbProduct.tags || []).join(' ')}`.toLowerCase().includes(slotKey)) {
          qty = explicitQty;
        }
      }

      const cappedQty = Math.min(qty, dbProduct.stock);
      const lineTotal = dbProduct.price * cappedQty;

      if (intent.budget && intent.budgetConstraint === 'HARD' && subtotal + lineTotal > intent.budget) {
        continue;
      }

      seenIds.add(dbProduct._id.toString());
      subtotal += lineTotal;
      validatedItems.push({
        product: dbProduct,
        quantity: cappedQty,
        requestedQuantity: qty,
        stockCapped: cappedQty < qty,
        reason: reviewService.sanitizeText(rawItem.reason, 300) || 'Selected for your shopping mission.',
        limitations: reviewService.sanitizeText(rawItem.limitations, 300) || 'Standard specifications apply.'
      });
    }

    if (validatedItems.length === 0 && fallbackProposal.items.length > 0) {
      return fallbackProposal;
    }

    let crossSell = fallbackProposal.crossSell;
    if (aiResult.crossSellProductId) {
      const csProd = allProducts.find(
        p =>
          p._id.toString() === aiResult.crossSellProductId &&
          p.stock > 0 &&
          !seenIds.has(p._id.toString()) &&
          !existingCartIds.includes(p._id.toString())
      );
      if (csProd) {
        crossSell = {
          product: csProd,
          reason: reviewService.sanitizeText(aiResult.crossSellReason, 250) || `Complements your ${intent.objective} setup.`
        };
      }
    }

    const budgetRemaining = intent.budget !== null ? Math.max(0, intent.budget - subtotal) : null;

    return {
      engine: 'GEMINI_AI',
      intent,
      summary: reviewService.sanitizeText(aiResult.summary, 500) || fallbackProposal.summary,
      tradeOffs: reviewService.sanitizeText(aiResult.tradeOffs, 400) || fallbackProposal.tradeOffs,
      items: validatedItems,
      estimatedSubtotal: subtotal,
      budget: intent.budget,
      budgetRemaining,
      crossSell
    };
  } catch (err) {
    console.warn('[SmartKart AI] Using deterministic fallback for shopping proposal:', err.message);
    return fallbackProposal;
  }
}

// 2. APPLY APPROVED PROPOSAL ITEMS TO PERSISTED CART
async function applyApprovedProposal({ user, items }) {
  if (!user || !user._id) {
    const err = new Error('Authentication required');
    err.status = 401;
    throw err;
  }

  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error('Please select at least one product to add to your cart');
    err.status = 400;
    throw err;
  }

  const normalizedAdditions = [];
  for (const entry of items) {
    const productId = entry?.productId || entry?.product?._id || entry?.product;
    const quantity = Number(entry?.quantity ?? 1);

    if (!isValidObjectId(productId)) {
      const err = new Error(`Invalid product ID: ${productId}`);
      err.status = 400;
      throw err;
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      const err = new Error('Quantity must be a positive integer');
      err.status = 400;
      throw err;
    }
    normalizedAdditions.push({ productId: productId.toString(), quantity });
  }

  if (isMongoStorage()) {
    const customer = await Customer.findById(user._id);
    if (!customer) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }
    if (!customer.cart) customer.cart = [];

    for (const addition of normalizedAdditions) {
      const product = await Product.findById(addition.productId);
      if (!product) {
        const err = new Error('One or more selected products were not found');
        err.status = 404;
        throw err;
      }
      if (product.stock <= 0) {
        const err = new Error(`${product.name} is currently out of stock`);
        err.status = 400;
        throw err;
      }

      const existingIdx = customer.cart.findIndex(
        ci => (ci.product?._id || ci.product).toString() === addition.productId
      );

      const newQty = existingIdx > -1
        ? customer.cart[existingIdx].quantity + addition.quantity
        : addition.quantity;

      if (newQty > product.stock) {
        const err = new Error(`Requested quantity for ${product.name} exceeds available stock (${product.stock} available)`);
        err.status = 400;
        throw err;
      }

      if (existingIdx > -1) {
        customer.cart[existingIdx].quantity = newQty;
      } else {
        customer.cart.push({ product: product._id, quantity: addition.quantity });
      }
    }

    // Invalidate stale discount offer when cart changes
    if (customer.activeDiscountOffer && customer.activeDiscountOffer.cartHash) {
      const newHash = inMemoryStore.computeCartHash(customer.cart);
      if (customer.activeDiscountOffer.cartHash !== newHash) {
        customer.activeDiscountOffer = undefined;
      }
    }

    await customer.save();
    await customer.populate({
      path: 'cart.product',
      select: 'sku name brand price category image stock description tags useCase attributes discountEligible'
    });

    const activeCart = (customer.cart || []).filter(item => item.product != null);
    return {
      cart: activeCart,
      activeDiscountOffer: customer.activeDiscountOffer || null
    };
  } else {
    // Validate all items first before mutating so partial failures don't corrupt state
    const existingCart = inMemoryStore.getCart(user._id);
    for (const addition of normalizedAdditions) {
      const product = inMemoryStore.getProductById(addition.productId);
      if (!product) {
        const err = new Error('One or more selected products were not found');
        err.status = 404;
        throw err;
      }
      if (product.stock <= 0) {
        const err = new Error(`${product.name} is currently out of stock`);
        err.status = 400;
        throw err;
      }
      const existingItem = existingCart.find(
        ci => (ci.product?._id || ci.product).toString() === addition.productId
      );
      const totalNeeded = (existingItem ? existingItem.quantity : 0) + addition.quantity;
      if (totalNeeded > product.stock) {
        const err = new Error(`Requested quantity for ${product.name} exceeds available stock (${product.stock} available)`);
        err.status = 400;
        throw err;
      }
    }

    let updatedCart = existingCart;
    for (const addition of normalizedAdditions) {
      updatedCart = inMemoryStore.addToCart(user._id, addition.productId, addition.quantity);
    }

    return {
      cart: updatedCart,
      activeDiscountOffer: inMemoryStore.getActiveDiscountOffer(user._id)
    };
  }
}

// 3. DYNAMIC PRICE NEGOTIATION (Bound strictly to persisted cart, max 15%)
async function negotiateCartDiscount({ user, message }) {
  if (!user || !user._id) {
    const err = new Error('Authentication required');
    err.status = 401;
    throw err;
  }

  const persistedCart = await fetchPersistedCartForUser(user._id);
  if (!persistedCart || persistedCart.length === 0) {
    const err = new Error('Your cart is empty. Please add products to your cart before negotiating a discount.');
    err.status = 400;
    throw err;
  }

  const cleanMessage = reviewService.sanitizeText(message || 'Can I get a discount on my cart?', 400);
  const ruleDecision = fallbackService.evaluateFallbackNegotiation(cleanMessage, persistedCart);

  // Authoritative backend calculation
  const subtotal = persistedCart.reduce(
    (sum, item) => sum + (item.product?.price || 0) * (item.quantity || 1),
    0
  );
  const eligibleSubtotal = persistedCart.reduce(
    (sum, item) => sum + (item.product?.discountEligible !== false ? (item.product?.price || 0) * (item.quantity || 1) : 0),
    0
  );

  // Hard 15% cap enforced server-side
  const finalPercent = Math.min(15, Math.max(0, Math.round(ruleDecision.discountPercent)));
  const discountAmount = Math.round((eligibleSubtotal * finalPercent) / 100);
  const finalTotal = Math.max(0, subtotal - discountAmount);

  let explanation = ruleDecision.explanation;
  let engine = 'FALLBACK_RULES';

  if (geminiService.isGeminiConfigured()) {
    try {
      const { Type } = geminiService;
      const aiRes = await geminiService.generateStructuredJson({
        task: 'smart_cart_negotiate',
        systemInstruction:
          'You are SmartKart Deal Concierge. Explain the backend-approved discount clearly and politely in 1-2 sentences. ' +
          'Never promise a higher discount than backendApprovedPercent (max 15%). Never invent coupon codes.',
        prompt: JSON.stringify({
          customerRequest: cleanMessage,
          cartSubtotal: subtotal,
          itemCount: persistedCart.length,
          backendApprovedPercent: finalPercent,
          discountAmountINR: discountAmount,
          finalTotalINR: finalTotal
        }),
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            message: { type: Type.STRING }
          },
          required: ['message']
        }
      });
      if (aiRes && aiRes.message) {
        explanation = reviewService.sanitizeText(aiRes.message, 350);
        engine = 'GEMINI_AI';
      }
    } catch (err) {
      console.warn('[SmartKart AI] Using deterministic fallback for negotiation message:', err.message);
    }
  }

  const cartHash = inMemoryStore.computeCartHash(persistedCart);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes validity
  const offer = finalPercent > 0
    ? {
        offerId: 'offer_' + crypto.randomBytes(6).toString('hex'),
        discountPercent: finalPercent,
        discountAmount,
        cartHash,
        reason: explanation,
        expiresAt,
        createdAt: new Date()
      }
    : null;

  if (isMongoStorage()) {
    await Customer.findByIdAndUpdate(user._id, {
      $set: { activeDiscountOffer: offer }
    });
  } else {
    inMemoryStore.setCustomerDiscountOffer(user._id, offer);
  }

  return {
    engine,
    approved: finalPercent > 0,
    discountPercent: finalPercent,
    discountAmount,
    subtotal,
    finalTotal,
    offer,
    message: explanation
  };
}

// Validate and compute active discount for checkout/cart summary
async function getValidatedCartDiscount(userId, persistedCart) {
  if (!userId || !Array.isArray(persistedCart) || persistedCart.length === 0) {
    return {
      subtotal: 0,
      discountPercent: 0,
      discountAmount: 0,
      finalTotal: 0,
      activeOffer: null
    };
  }

  const subtotal = persistedCart.reduce(
    (sum, item) => sum + (item.product?.price || 0) * (item.quantity || 1),
    0
  );
  const eligibleSubtotal = persistedCart.reduce(
    (sum, item) => sum + (item.product?.discountEligible !== false ? (item.product?.price || 0) * (item.quantity || 1) : 0),
    0
  );

  let offer = null;
  if (isMongoStorage()) {
    const cust = await Customer.findById(userId).lean();
    offer = cust?.activeDiscountOffer || null;
  } else {
    offer = inMemoryStore.getActiveDiscountOffer(userId);
  }

  const currentHash = inMemoryStore.computeCartHash(persistedCart);
  const now = new Date();

  if (
    !offer ||
    !offer.offerId ||
    offer.discountPercent <= 0 ||
    offer.cartHash !== currentHash ||
    (offer.expiresAt && new Date(offer.expiresAt) < now)
  ) {
    return {
      subtotal,
      discountPercent: 0,
      discountAmount: 0,
      finalTotal: subtotal,
      activeOffer: null
    };
  }

  const clampedPercent = Math.min(15, Math.max(0, offer.discountPercent));
  const discountAmount = Math.round((eligibleSubtotal * clampedPercent) / 100);
  const finalTotal = Math.max(0, subtotal - discountAmount);

  return {
    subtotal,
    discountPercent: clampedPercent,
    discountAmount,
    finalTotal,
    activeOffer: {
      ...offer,
      discountPercent: clampedPercent,
      discountAmount
    }
  };
}

// 4. DISCOVER ALTERNATIVES FOR CAUTION / MIXED FEEDBACK ITEMS
async function discoverAlternativesForProduct(originalProduct, allProducts, cartProductIds, shoppingObjective) {
  const originalSlot = fallbackService.getProductSlotCategory(originalProduct);
  const excludedIds = new Set([
    originalProduct._id.toString(),
    ...(cartProductIds || []).map(String)
  ]);

  // Find in-stock products in same functional slot or category
  const candidates = (allProducts || []).filter(p => {
    if (p.stock <= 0 || excludedIds.has(p._id.toString())) return false;
    const slot = fallbackService.getProductSlotCategory(p);
    if (slot === originalSlot) return true;
    return p.category === originalProduct.category;
  });

  const enriched = [];
  for (const cand of candidates) {
    const { reviews, stats } = await reviewService.getProductReviews(cand._id.toString());
    const analysis = fallbackService.analyzeSingleProductReviews(cand, reviews, stats, shoppingObjective);

    // Prefer alternatives with GOOD CHOICE or higher rating
    const candAvg = stats.genuineRating ?? stats.demoRating ?? 3.5;
    let relevanceScore = 0;
    if (fallbackService.getProductSlotCategory(cand) === originalSlot) relevanceScore += 10;
    if (analysis.category === 'GOOD CHOICE') relevanceScore += 6;
    relevanceScore += candAvg;

    const priceDelta = cand.price - originalProduct.price;
    const tradeOffExplanation = priceDelta > 0
      ? `Costs ₹${Math.abs(priceDelta).toLocaleString('en-IN')} more than ${originalProduct.name}, trading a higher upfront price for stronger buyer feedback (${candAvg}/5) and upgraded specifications.`
      : priceDelta < 0
      ? `Saves ₹${Math.abs(priceDelta).toLocaleString('en-IN')} compared to ${originalProduct.name} while maintaining ${candAvg}/5 buyer satisfaction.`
      : `Matches the price of ${originalProduct.name} while offering a different feature balance.`;

    enriched.push({
      relevanceScore,
      alternative: {
        _id: cand._id.toString(),
        sku: cand.sku,
        name: cand.name,
        brand: cand.brand || 'SmartKart',
        category: cand.category,
        price: cand.price,
        stock: cand.stock,
        image: cand.image,
        description: cand.description,
        attributes: cand.attributes || {},
        genuineRating: stats.genuineRating,
        genuineReviewCount: stats.genuineReviewCount,
        verifiedPurchaseCount: stats.verifiedPurchaseCount,
        demoReviewCount: stats.demoReviewCount,
        demoRating: stats.demoRating,
        aiReviewSummary: analysis.headline,
        assessmentCategory: analysis.category,
        mainStrengths: analysis.strengths.slice(0, 2),
        potentialDrawbacks: analysis.concerns.length > 0
          ? analysis.concerns.slice(0, 2)
          : [priceDelta > 0 ? `Higher price point (+₹${priceDelta.toLocaleString('en-IN')})` : 'Standard warranty coverage'],
        whyItSuitsYou: `Addresses the concerns flagged on ${originalProduct.name} with ${analysis.positiveThemes[0] || cand.description}.`,
        comparison: {
          originalProductName: originalProduct.name,
          originalPrice: originalProduct.price,
          alternativePrice: cand.price,
          priceDelta,
          tradeOffExplanation
        }
      }
    });
  }

  enriched.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return enriched.slice(0, 3).map(e => e.alternative);
}

// 5. SMARTKART AI REVIEW + REGRET SHIELD + ALTERNATIVE INTELLIGENCE
async function reviewPersistedCart({ user, shoppingObjective = '' }) {
  if (!user || !user._id) {
    const err = new Error('Authentication required');
    err.status = 401;
    throw err;
  }

  const persistedCart = await fetchPersistedCartForUser(user._id);
  if (!persistedCart || persistedCart.length === 0) {
    const err = new Error('AI Review is only available when your cart contains at least one product.');
    err.status = 400;
    throw err;
  }

  const cleanObjective = reviewService.sanitizeText(shoppingObjective, 300);
  const allProducts = await fetchAllCatalogueProducts();
  const cartProductIds = persistedCart.map(item => (item.product?._id || item.product).toString());

  const itemAnalyses = [];
  for (const cartItem of persistedCart) {
    const prod = cartItem.product;
    const prodId = prod._id.toString();
    const { reviews, stats } = await reviewService.getProductReviews(prodId);

    const analysis = fallbackService.analyzeSingleProductReviews(prod, reviews, stats, cleanObjective);

    itemAnalyses.push({
      ...analysis,
      _productRef: prod,
      quantity: cartItem.quantity,
      price: prod.price,
      image: prod.image,
      categoryName: prod.category,
      alternatives: []
    });
  }

  let engine = 'FALLBACK_RULES';
  let overallSummary = '';

  // Gemini AI synthesis: generates both overallSummary and rich per-product AI evaluation
  // (especially valuable when a product has 0 stored reviews, using product specs & category intelligence)
  if (geminiService.isGeminiConfigured()) {
    try {
      const { Type } = geminiService;
      const aiRes = await geminiService.generateStructuredJson({
        task: 'smart_cart_review',
        systemInstruction:
          'You are SmartKart AI Review & Regret Shield, an expert product analyst. ' +
          'For each cart product: if stored reviews exist, synthesize their strengths and complaints honestly. ' +
          'If a product has 0 stored reviews, NEVER say "insufficient data" — instead, use AI product intelligence to evaluate its technical specifications, brand positioning, price value in INR, realistic trade-offs/considerations, and suitability for the customer shoppingObjective. ' +
          'Valid item categories are strictly: "GOOD CHOICE", "MIXED FEEDBACK", or "CAUTION".',
        prompt: JSON.stringify({
          shoppingObjective: cleanObjective || 'General everyday shopping & value',
          items: itemAnalyses.map(ia => ({
            productId: ia.productId,
            productName: ia.productName,
            brand: ia._productRef.brand || 'SmartKart',
            categoryName: ia.categoryName,
            priceINR: ia.price,
            description: ia._productRef.description,
            attributes: ia._productRef.attributes || {},
            useCase: ia._productRef.useCase || [],
            storedReviewStats: ia.reviewBreakdown,
            baselineCategory: ia.category,
            baselineHeadline: ia.headline,
            baselineStrengths: ia.positiveThemes,
            baselineConcerns: ia.commonComplaints,
            baselineRegretFlags: ia.regretShieldFlags
          }))
        }),
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallSummary: { type: Type.STRING },
            itemEvaluations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  productId: { type: Type.STRING },
                  category: { type: Type.STRING },
                  headline: { type: Type.STRING },
                  positiveThemes: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  commonComplaints: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  regretShieldFlags: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  }
                },
                required: ['productId', 'category', 'headline', 'positiveThemes', 'commonComplaints', 'regretShieldFlags']
              }
            }
          },
          required: ['overallSummary']
        }
      });

      if (aiRes && aiRes.overallSummary) {
        overallSummary = reviewService.sanitizeText(aiRes.overallSummary, 500);
        engine = 'GEMINI_AI';
      }

      if (aiRes && Array.isArray(aiRes.itemEvaluations)) {
        const validCategories = new Set(['GOOD CHOICE', 'MIXED FEEDBACK', 'CAUTION']);
        for (const ia of itemAnalyses) {
          const aiItem = aiRes.itemEvaluations.find(e => e && e.productId === ia.productId);
          if (!aiItem) continue;

          // If stored reviews exist and flagged CAUTION, preserve CAUTION safety; otherwise allow AI classification
          const hasStoredReviews = (ia.reviewBreakdown?.totalReviewCount || 0) > 0;
          if (!hasStoredReviews && validCategories.has(aiItem.category)) {
            ia.category = aiItem.category;
          } else if (hasStoredReviews && ia.category !== 'CAUTION' && validCategories.has(aiItem.category)) {
            ia.category = aiItem.category;
          }

          if (aiItem.headline) {
            ia.headline = reviewService.sanitizeText(aiItem.headline, 240) || ia.headline;
          }
          if (Array.isArray(aiItem.positiveThemes) && aiItem.positiveThemes.length > 0) {
            const cleanedPros = aiItem.positiveThemes
              .map(s => reviewService.sanitizeText(s, 220))
              .filter(Boolean)
              .slice(0, 4);
            if (cleanedPros.length > 0) {
              ia.positiveThemes = cleanedPros;
              ia.strengths = cleanedPros;
            }
          }
          if (Array.isArray(aiItem.commonComplaints) && aiItem.commonComplaints.length > 0) {
            const cleanedCons = aiItem.commonComplaints
              .map(s => reviewService.sanitizeText(s, 220))
              .filter(Boolean)
              .slice(0, 4);
            if (cleanedCons.length > 0) {
              ia.commonComplaints = cleanedCons;
              ia.concerns = cleanedCons;
            }
          }
          if (Array.isArray(aiItem.regretShieldFlags) && aiItem.regretShieldFlags.length > 0) {
            const cleanedFlags = aiItem.regretShieldFlags
              .map(s => reviewService.sanitizeText(s, 240))
              .filter(Boolean)
              .slice(0, 3);
            if (cleanedFlags.length > 0) {
              ia.regretShieldFlags = cleanedFlags;
            }
          }
        }
      }
    } catch (err) {
      console.warn('[SmartKart AI] Using deterministic fallback for cart review summary:', err.message);
    }
  }

  // Discover up to 3 real catalogue alternatives when CAUTION or MIXED FEEDBACK
  for (const ia of itemAnalyses) {
    if (ia.category === 'CAUTION' || ia.category === 'MIXED FEEDBACK') {
      ia.alternatives = await discoverAlternativesForProduct(
        ia._productRef,
        allProducts,
        cartProductIds,
        cleanObjective
      );
    }
    delete ia._productRef;
  }

  const cautionCount = itemAnalyses.filter(i => i.category === 'CAUTION').length;
  const mixedCount = itemAnalyses.filter(i => i.category === 'MIXED FEEDBACK').length;
  const goodCount = itemAnalyses.filter(i => i.category === 'GOOD CHOICE').length;

  let overallCategory = 'GOOD CHOICE';
  if (cautionCount > 0) {
    overallCategory = 'CAUTION';
  } else if (mixedCount > 0) {
    overallCategory = 'MIXED FEEDBACK';
  }

  if (!overallSummary) {
    overallSummary = `Analysed ${itemAnalyses.length} cart ${itemAnalyses.length === 1 ? 'product' : 'products'}: ` +
      `${goodCount} Good Choice, ${mixedCount} Mixed Feedback, ${cautionCount} Caution` +
      (cleanObjective ? ` evaluated against your "${cleanObjective}" objective.` : '.');
  }

  return {
    engine,
    shoppingObjective: cleanObjective || null,
    overallCategory,
    overallSummary,
    items: itemAnalyses
  };
}

// 6. EXPLICIT CUSTOMER-CONFIRMED PRODUCT REPLACEMENT
async function replaceProductInPersistedCart({ user, oldProductId, newProductId }) {
  if (!user || !user._id) {
    const err = new Error('Authentication required');
    err.status = 401;
    throw err;
  }

  if (!isValidObjectId(oldProductId) || !isValidObjectId(newProductId)) {
    const err = new Error('Invalid product IDs supplied for replacement');
    err.status = 400;
    throw err;
  }

  if (oldProductId === newProductId) {
    const err = new Error('Replacement product must be different from the original product');
    err.status = 400;
    throw err;
  }

  if (isMongoStorage()) {
    const customer = await Customer.findById(user._id);
    if (!customer) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }

    const oldIdx = (customer.cart || []).findIndex(
      i => (i.product?._id || i.product).toString() === oldProductId
    );
    if (oldIdx === -1) {
      const err = new Error('Original product is not in your cart');
      err.status = 404;
      throw err;
    }

    const newProduct = await Product.findById(newProductId);
    if (!newProduct) {
      const err = new Error('Replacement product not found');
      err.status = 404;
      throw err;
    }
    if (newProduct.stock <= 0) {
      const err = new Error('Replacement product is out of stock');
      err.status = 400;
      throw err;
    }

    const preservedQty = customer.cart[oldIdx].quantity || 1;
    const existingNewIdx = customer.cart.findIndex(
      (i, idx) => idx !== oldIdx && (i.product?._id || i.product).toString() === newProductId
    );

    const totalNeededQty = existingNewIdx > -1
      ? customer.cart[existingNewIdx].quantity + preservedQty
      : preservedQty;

    if (totalNeededQty > newProduct.stock) {
      const err = new Error(`Insufficient stock for ${newProduct.name} (${newProduct.stock} available)`);
      err.status = 400;
      throw err;
    }

    if (existingNewIdx > -1) {
      customer.cart[existingNewIdx].quantity = totalNeededQty;
      customer.cart.splice(oldIdx, 1);
    } else {
      customer.cart[oldIdx].product = newProduct._id;
      customer.cart[oldIdx].quantity = preservedQty;
    }

    // Invalidate stale discount offer on replacement
    customer.activeDiscountOffer = undefined;
    await customer.save();

    await customer.populate({
      path: 'cart.product',
      select: 'sku name brand price category image stock description tags useCase attributes discountEligible'
    });

    const activeCart = (customer.cart || []).filter(item => item.product != null);
    return {
      cart: activeCart,
      replacedQuantity: preservedQty,
      newProduct: {
        _id: newProduct._id,
        name: newProduct.name,
        price: newProduct.price
      },
      activeDiscountOffer: null
    };
  } else {
    try {
      const updatedCart = inMemoryStore.replaceCartItem(user._id, oldProductId, newProductId);
      const newProduct = inMemoryStore.getProductById(newProductId);
      return {
        cart: updatedCart,
        newProduct: {
          _id: newProduct._id,
          name: newProduct.name,
          price: newProduct.price
        },
        activeDiscountOffer: inMemoryStore.getActiveDiscountOffer(user._id)
      };
    } catch (err) {
      const status = err.message.includes('not found') || err.message.includes('not in your cart') ? 404 : 400;
      const wrapped = new Error(err.message);
      wrapped.status = status;
      throw wrapped;
    }
  }
}

module.exports = {
  generateShoppingProposal,
  applyApprovedProposal,
  negotiateCartDiscount,
  getValidatedCartDiscount,
  reviewPersistedCart,
  replaceProductInPersistedCart,
  discoverAlternativesForProduct
};
