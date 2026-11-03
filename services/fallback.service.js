// Deterministic rule-based intelligence engine for SmartKart 2.0
// Never fabricates products, prices, stock, or customer reviews.

const WORD_NUMBERS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10
};

const QUANTITY_NOUN_SYNONYMS = {
  chair: ['chair', 'chairs', 'seating'],
  table: ['table', 'tables', 'desk', 'desks'],
  monitor: ['monitor', 'monitors', 'screen', 'screens', 'display'],
  keyboard: ['keyboard', 'keyboards'],
  mouse: ['mouse', 'mice'],
  headphone: ['headphone', 'headphones', 'headset', 'headsets'],
  lamp: ['lamp', 'lamps', 'light', 'lights'],
  kettle: ['kettle', 'kettles'],
  bottle: ['bottle', 'bottles', 'flask', 'flasks'],
  notebook: ['notebook', 'notebooks'],
  calculator: ['calculator', 'calculators'],
  pen: ['pen', 'pens'],
  backpack: ['backpack', 'backpacks', 'bag', 'bags'],
  webcam: ['webcam', 'webcams', 'camera'],
  stand: ['stand', 'stands', 'riser'],
  hub: ['hub', 'hubs', 'dock']
};

function parseBudget(text) {
  if (!text || typeof text !== 'string') return { budget: null, constraint: 'FLEXIBLE' };
  const cleaned = text.replace(/,/g, '');

  // Look for patterns like "under ₹30000", "within 5000", "below 15k", "budget 20000", "₹5000"
  const kMatch = cleaned.match(/(?:under|within|below|max|budget(?:\s+of)?|around|for|₹|rs\.?|inr)\s*(\d+(?:\.\d+)?)\s*k\b/i);
  if (kMatch) {
    const amount = Math.round(parseFloat(kMatch[1]) * 1000);
    const isHard = /\b(under|within|below|max|maximum|strictly|less than)\b/i.test(cleaned);
    return { budget: amount, constraint: isHard ? 'HARD' : 'FLEXIBLE' };
  }

  const numMatch = cleaned.match(/(?:under|within|below|max|budget(?:\s+of)?|around|₹|rs\.?|inr)\s*(\d{3,7})\b/i);
  if (numMatch) {
    const amount = parseInt(numMatch[1], 10);
    const isHard = /\b(under|within|below|max|maximum|strictly|less than)\b/i.test(cleaned);
    return { budget: amount, constraint: isHard ? 'HARD' : 'FLEXIBLE' };
  }

  return { budget: null, constraint: 'FLEXIBLE' };
}

function parseExplicitQuantities(text) {
  const result = {};
  if (!text || typeof text !== 'string') return result;
  const lower = text.toLowerCase();

  // Match "4 chairs", "four chairs", "2 monitors", etc.
  const regex = /\b(one|two|three|four|five|six|seven|eight|nine|ten|\d{1,2})\s+([a-z-]+?)(?:s|es)?\b/gi;
  let match;
  while ((match = regex.exec(lower)) !== null) {
    const rawNum = match[1];
    const rawNoun = match[2];
    const qty = WORD_NUMBERS[rawNum] || parseInt(rawNum, 10);
    if (!qty || qty < 1 || qty > 50) continue;

    for (const [canonical, synonyms] of Object.entries(QUANTITY_NOUN_SYNONYMS)) {
      if (synonyms.includes(rawNoun) || synonyms.includes(rawNoun + 's')) {
        result[canonical] = qty;
      }
    }
  }
  return result;
}

function parseExclusions(text) {
  if (!text || typeof text !== 'string') return [];
  const lower = text.toLowerCase();
  const excluded = [];
  const match = lower.match(/\b(?:without|no|exclude|excluding|except)\s+([a-z\s,]+?)(?:[.;]|$|\band\b|\bunder\b|\bwithin\b)/i);
  if (match && match[1]) {
    const parts = match[1].split(/,|\bor\b/).map(s => s.trim()).filter(Boolean);
    excluded.push(...parts);
  }
  return excluded;
}

function detectObjective(text) {
  const lower = (text || '').toLowerCase();
  if (/\bgam(?:e|ing|er)\b/.test(lower)) return 'gaming';
  if (/\bhostel|dorm|pg\b/.test(lower)) return 'hostel';
  if (/\bwork[\s-]*from[\s-]*home|wfh|remote[\s-]*work|office\b/.test(lower)) return 'work-from-home';
  if (/\bstudy|student|college|exam|university|lecture\b/.test(lower)) return 'study';
  if (/\bhome|apartment|room|minimalist\b/.test(lower)) return 'home';
  return 'general';
}

function detectPriorities(text) {
  const lower = (text || '').toLowerCase();
  const priorities = [];
  if (/\bperformance|fast|165hz|pro|competitive|high[\s-]*end\b/.test(lower)) priorities.push('performance');
  if (/\bquality|premium|durable|best|ergonomic|comfort\b/.test(lower)) priorities.push('quality');
  if (/\baffordable|budget|cheap|value|economical|starter\b/.test(lower)) priorities.push('value');
  if (/\bquiet|silent|noise[\s-]*cancell?ing|anc|shared\b/.test(lower)) priorities.push('quiet');
  if (/\bcompact|foldable|portable|lightweight|small\b/.test(lower)) priorities.push('compact');
  return priorities.length > 0 ? priorities : ['balanced'];
}

function extractShoppingIntent(userMessage) {
  const { budget, constraint } = parseBudget(userMessage);
  const objective = detectObjective(userMessage);
  const explicitQuantities = parseExplicitQuantities(userMessage);
  const excludedTerms = parseExclusions(userMessage);
  const priorities = detectPriorities(userMessage);

  const stopWords = new Set([
    'build', 'me', 'a', 'an', 'the', 'find', 'need', 'want', 'for', 'under', 'within',
    'below', 'setup', 'kit', 'with', 'good', 'quality', 'products', 'items', 'in',
    'my', 'to', 'and', 'or', 'of', 'rs', 'inr', 'complete', 'starter', 'essentials'
  ]);

  const keywords = (userMessage || '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w) && !/^\d+$/.test(w));

  return {
    objective,
    budget,
    budgetConstraint: constraint,
    explicitQuantities,
    excludedTerms,
    priorities,
    keywords
  };
}

function matchesCanonicalSlot(product, slotKey) {
  const text = `${product.name} ${(product.tags || []).join(' ')} ${product.category}`.toLowerCase();
  const synonyms = QUANTITY_NOUN_SYNONYMS[slotKey] || [slotKey];
  return synonyms.some(s => text.includes(s));
}

function isExcludedProduct(product, excludedTerms) {
  if (!excludedTerms || excludedTerms.length === 0) return false;
  const hay = `${product.name} ${product.category} ${(product.tags || []).join(' ')}`.toLowerCase();
  return excludedTerms.some(term => term.length > 2 && hay.includes(term));
}

function getProductSlotCategory(product) {
  const hay = `${product.name} ${(product.tags || []).join(' ')}`.toLowerCase();
  if (hay.includes('monitor')) return 'monitor';
  if (hay.includes('keyboard')) return 'keyboard';
  if (hay.includes('mouse')) return 'mouse';
  if (hay.includes('headphone') || hay.includes('headset')) return 'headphone';
  if (hay.includes('chair')) return 'chair';
  if (hay.includes('desk') || hay.includes('bed-table') || hay.includes('study-table')) return 'table';
  if (hay.includes('lamp') || hay.includes('light')) return 'lamp';
  if (hay.includes('kettle')) return 'kettle';
  if (hay.includes('power-strip') || hay.includes('surge')) return 'power-strip';
  if (hay.includes('bottle') || hay.includes('flask')) return 'bottle';
  if (hay.includes('notebook')) return 'notebook';
  if (hay.includes('calculator')) return 'calculator';
  if (hay.includes('webcam')) return 'webcam';
  if (hay.includes('laptop-stand')) return 'stand';
  if (hay.includes('usb-hub') || hay.includes('dock')) return 'hub';
  if (hay.includes('backpack')) return 'backpack';
  if (hay.includes('book-stand')) return 'book-stand';
  if (hay.includes('footrest')) return 'footrest';
  if (hay.includes('glasses')) return 'glasses';
  return product._id.toString();
}

function buildProductLimitation(product) {
  const nameLower = product.name.toLowerCase();
  if (nameLower.includes('hyperpulse')) {
    return 'Wired connection only; earcups can feel warm during sessions over 45 minutes.';
  }
  if (nameLower.includes('apexsit')) {
    return 'Fixed non-adjustable armrests and basic foam padding meant for shorter study sessions.';
  }
  if (nameLower.includes('reddragon') || nameLower.includes('kumara')) {
    return 'Wired USB connection; mechanical switches produce audible click sound in quiet rooms.';
  }
  if (nameLower.includes('solimo foldable')) {
    return 'Compact lap/bed surface (60x40cm); not a full-height standing or office desk.';
  }
  if (nameLower.includes('kettle')) {
    return 'Requires a 1500W wall socket; designed for boiling water, coffee, and instant meals.';
  }
  if (product.stock <= 5) {
    return `Limited inventory remaining (${product.stock} units in stock).`;
  }
  return 'Standard manufacturer warranty applies; check dimensions/compatibility for your setup.';
}

function buildSelectionReason(product, intent, qty) {
  const objLabel = intent.objective === 'general' ? 'your request' : `your ${intent.objective} setup`;
  const qtyNote = qty > 1 ? ` (${qty} units as requested)` : '';
  const attrParts = [];
  if (product.attributes && typeof product.attributes === 'object') {
    for (const [k, v] of Object.entries(product.attributes).slice(0, 2)) {
      attrParts.push(`${k}: ${v}`);
    }
  }
  const specText = attrParts.length > 0 ? ` featuring ${attrParts.join(', ')}` : '';
  return `Selected for ${objLabel}${qtyNote}${specText} at ₹${product.price.toLocaleString('en-IN')}.`;
}

function selectCrossSellCandidate(allProducts, selectedIds, existingCartIds, intent) {
  const excludedSet = new Set([
    ...selectedIds.map(String),
    ...(existingCartIds || []).map(String)
  ]);

  const available = allProducts.filter(
    p => p.stock > 0 && !excludedSet.has(p._id.toString()) && !isExcludedProduct(p, intent.excludedTerms)
  );
  if (available.length === 0) return null;

  // Check compatibility SKU links from selected products
  const selectedProducts = allProducts.filter(p => selectedIds.includes(p._id.toString()));
  const compatibleSkus = new Set();
  for (const sp of selectedProducts) {
    if (Array.isArray(sp.compatibility)) {
      sp.compatibility.forEach(sku => compatibleSkus.add(sku));
    }
  }

  const compatibleMatches = available
    .filter(p => p.sku && compatibleSkus.has(p.sku))
    .sort((a, b) => a.price - b.price);

  if (compatibleMatches.length > 0) {
    const pick = compatibleMatches[0];
    return {
      product: pick,
      reason: `Complements your selected ${selectedProducts[0]?.name || 'setup'} with direct compatibility.`
    };
  }

  // Fallback contextual match by useCase
  const useCaseMatches = available
    .filter(p => Array.isArray(p.useCase) && p.useCase.includes(intent.objective))
    .sort((a, b) => a.price - b.price);

  if (useCaseMatches.length > 0) {
    const pick = useCaseMatches[0];
    return {
      product: pick,
      reason: `Useful add-on frequently paired with ${intent.objective} setups.`
    };
  }

  return null;
}

function buildFallbackShoppingProposal(userMessage, candidateProducts, allProducts, existingCartIds = []) {
  const intent = extractShoppingIntent(userMessage);
  const available = (candidateProducts || []).filter(
    p => p.stock > 0 && !isExcludedProduct(p, intent.excludedTerms)
  );

  const selectedItems = [];
  const usedSlots = new Set();
  let runningTotal = 0;
  const budgetCap = intent.budget;

  // 1. Fulfill any explicit quantity requests first (e.g. "4 chairs", "2 monitors")
  for (const [slotKey, requestedQty] of Object.entries(intent.explicitQuantities)) {
    const matching = available
      .filter(p => matchesCanonicalSlot(p, slotKey))
      .sort((a, b) => {
        if (intent.priorities.includes('quality') || intent.priorities.includes('performance')) {
          return b.price - a.price;
        }
        return a.price - b.price;
      });

    for (const candidate of matching) {
      const fulfillableQty = Math.min(requestedQty, candidate.stock);
      if (fulfillableQty < 1) continue;
      const lineCost = candidate.price * fulfillableQty;
      if (budgetCap && runningTotal + lineCost > budgetCap) continue;

      selectedItems.push({
        product: candidate,
        quantity: fulfillableQty,
        requestedQuantity: requestedQty,
        stockCapped: fulfillableQty < requestedQty,
        reason: buildSelectionReason(candidate, intent, fulfillableQty),
        limitations: buildProductLimitation(candidate)
      });
      runningTotal += lineCost;
      usedSlots.add(getProductSlotCategory(candidate));
      break;
    }
  }

  // 2. Define mission blueprint slots so setups are cohesive and realistic
  const missionBlueprints = {
    gaming: ['monitor', 'keyboard', 'mouse', 'headphone', 'chair', 'desk'],
    hostel: ['table', 'kettle', 'lamp', 'power-strip', 'bottle', 'notebook'],
    'work-from-home': ['chair', 'table', 'keyboard', 'mouse', 'webcam', 'stand', 'hub'],
    study: ['lamp', 'headphone', 'table', 'calculator', 'notebook', 'book-stand'],
    home: ['lamp', 'kettle', 'power-strip', 'bottle']
  };

  const blueprintSlots = missionBlueprints[intent.objective] || [];

  if (blueprintSlots.length > 0 && Object.keys(intent.explicitQuantities).length === 0) {
    for (const slot of blueprintSlots) {
      if (usedSlots.has(slot)) continue;
      const slotCandidates = available
        .filter(p => getProductSlotCategory(p) === slot)
        .sort((a, b) => {
          // If tight budget (<= 6000), prefer lower price; if higher budget & quality priority, prefer mid/high
          if (budgetCap && budgetCap <= 6000) return a.price - b.price;
          if (intent.priorities.includes('quality') || intent.priorities.includes('performance')) {
            return b.price - a.price;
          }
          return a.price - b.price;
        });

      for (const candidate of slotCandidates) {
        if (budgetCap && runningTotal + candidate.price > budgetCap) continue;
        selectedItems.push({
          product: candidate,
          quantity: 1,
          requestedQuantity: 1,
          stockCapped: false,
          reason: buildSelectionReason(candidate, intent, 1),
          limitations: buildProductLimitation(candidate)
        });
        runningTotal += candidate.price;
        usedSlots.add(slot);
        break;
      }
    }
  }

  // 3. Direct keyword match fallback (e.g. "Find affordable headphones for studying")
  if (selectedItems.length === 0) {
    const scored = available
      .map(p => {
        const hay = `${p.name} ${p.brand || ''} ${p.category} ${p.description} ${(p.tags || []).join(' ')} ${(p.useCase || []).join(' ')}`.toLowerCase();
        let score = 0;
        for (const kw of intent.keywords) {
          if (hay.includes(kw)) score += 3;
        }
        if (Array.isArray(p.useCase) && p.useCase.includes(intent.objective)) {
          score += 2;
        }
        return { product: p, score };
      })
      .filter(entry => entry.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.product.price - b.product.price;
      });

    for (const entry of scored) {
      const candidate = entry.product;
      const slot = getProductSlotCategory(candidate);
      if (usedSlots.has(slot) && selectedItems.length >= 2) continue;
      if (budgetCap && runningTotal + candidate.price > budgetCap) continue;

      selectedItems.push({
        product: candidate,
        quantity: 1,
        requestedQuantity: 1,
        stockCapped: false,
        reason: buildSelectionReason(candidate, intent, 1),
        limitations: buildProductLimitation(candidate)
      });
      runningTotal += candidate.price;
      usedSlots.add(slot);
      if (selectedItems.length >= 4) break;
    }
  }

  const selectedIds = selectedItems.map(i => i.product._id.toString());
  const crossSell = selectCrossSellCandidate(allProducts || available, selectedIds, existingCartIds, intent);

  const budgetRemaining = budgetCap !== null ? Math.max(0, budgetCap - runningTotal) : null;

  const summary = selectedItems.length > 0
    ? `Built a ${intent.objective === 'general' ? 'curated' : intent.objective} proposal with ${selectedItems.length} ${selectedItems.length === 1 ? 'product' : 'products'} totalling ₹${runningTotal.toLocaleString('en-IN')}${budgetCap ? ` within your ₹${budgetCap.toLocaleString('en-IN')} budget (₹${budgetRemaining.toLocaleString('en-IN')} remaining)` : ''}. Nothing has been added to your cart yet—review and approve the items you want.`
    : `No in-stock products matched all constraints${budgetCap ? ` under ₹${budgetCap.toLocaleString('en-IN')}` : ''}. Try adjusting your budget or requirements.`;

  return {
    engine: 'FALLBACK_RULES',
    intent,
    summary,
    tradeOffs: budgetCap
      ? `Prioritized essential ${intent.objective} items that fit strictly inside ₹${budgetCap.toLocaleString('en-IN')} without padding the basket with unnecessary extras.`
      : 'Selected balanced products based on your stated use case and catalogue availability.',
    items: selectedItems,
    estimatedSubtotal: runningTotal,
    budget: budgetCap,
    budgetRemaining,
    crossSell
  };
}

function evaluateFallbackNegotiation(userMessage, cartItems) {
  const lower = (userMessage || '').toLowerCase();
  const reqMatch = lower.match(/(\d{1,2})\s*%/);
  const requestedPercent = reqMatch ? parseInt(reqMatch[1], 10) : null;

  const eligibleItems = (cartItems || []).filter(item => item.product && item.product.discountEligible !== false);
  const eligibleSubtotal = eligibleItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const totalUnits = eligibleItems.reduce((sum, item) => sum + item.quantity, 0);

  if (eligibleSubtotal <= 0 || totalUnits === 0) {
    return {
      approved: false,
      discountPercent: 0,
      requestedPercent,
      explanation: 'Your cart does not currently contain discount-eligible products.'
    };
  }

  // Deterministic business rules for max 15% cap:
  // - Subtotal >= ₹50,000 or >= 4 units + >= ₹15,000 -> up to 15%
  // - Subtotal >= ₹20,000 or >= 3 units -> up to 12%
  // - Subtotal >= ₹5,000 or >= 2 units -> up to 10%
  // - Subtotal >= ₹1,500 -> up to 7%
  // - Any non-empty cart < ₹1,500 -> up to 5%
  let maxAllowedByTier = 5;
  if (eligibleSubtotal >= 50000 || (totalUnits >= 4 && eligibleSubtotal >= 15000)) {
    maxAllowedByTier = 15;
  } else if (eligibleSubtotal >= 20000 || totalUnits >= 3) {
    maxAllowedByTier = 12;
  } else if (eligibleSubtotal >= 5000 || totalUnits >= 2) {
    maxAllowedByTier = 10;
  } else if (eligibleSubtotal >= 1500) {
    maxAllowedByTier = 7;
  }

  // Enforce hard 15% ceiling
  const hardCeiling = Math.min(15, maxAllowedByTier);
  const approvedPercent = requestedPercent
    ? Math.min(requestedPercent, hardCeiling)
    : hardCeiling;

  const cappedNotice = requestedPercent && requestedPercent > 15
    ? `While ${requestedPercent}% exceeds our maximum 15% policy limit, we have approved ${approvedPercent}% off your current cart.`
    : requestedPercent && requestedPercent > approvedPercent
    ? `Based on your current cart total of ₹${eligibleSubtotal.toLocaleString('en-IN')} (${totalUnits} ${totalUnits === 1 ? 'unit' : 'units'}), the maximum eligible discount tier is ${approvedPercent}%.`
    : `Approved a ${approvedPercent}% bundle & cart value discount on your current persisted cart.`;

  return {
    approved: approvedPercent > 0,
    discountPercent: approvedPercent,
    requestedPercent,
    maxEligiblePercent: hardCeiling,
    explanation: cappedNotice
  };
}

function synthesizeAiProductReviewFromSpecs(product, stats, shoppingObjective) {
  const brand = product.brand || 'SmartKart';
  const categoryName = product.category || 'General';
  const priceFormatted = `₹${Number(product.price || 0).toLocaleString('en-IN')}`;
  const attrs = product.attributes && typeof product.attributes === 'object'
    ? Object.entries(product.attributes)
    : [];
  const useCases = Array.isArray(product.useCase) && product.useCase.length > 0
    ? product.useCase
    : ['everyday utility'];

  const positiveThemes = [];
  if (product.description) {
    positiveThemes.push(product.description);
  }
  if (attrs.length > 0) {
    const specSummary = attrs.map(([k, v]) => `${k}: ${v}`).join(' · ');
    positiveThemes.push(`Key technical specifications — ${specSummary}.`);
  }
  positiveThemes.push(
    `Engineered by ${brand} for ${useCases.join(', ')} workflows at a ${priceFormatted} price point.`
  );
  if (product.stock > 15) {
    positiveThemes.push(`Healthy inventory availability (${product.stock} units in stock) for immediate dispatch.`);
  }

  const commonComplaints = [];
  const baseLimitation = buildProductLimitation(product);
  if (baseLimitation) {
    commonComplaints.push(baseLimitation);
  }
  if (product.price >= 15000) {
    commonComplaints.push(
      `Premium upfront investment (${priceFormatted}) — best suited for buyers who will actively utilize its full specification set.`
    );
  } else if (product.price <= 1500) {
    commonComplaints.push(
      `Budget-oriented tier (${priceFormatted}) — prioritizes core functional value over luxury finishes.`
    );
  } else {
    commonComplaints.push(
      `Mid-range ${categoryName.toLowerCase()} positioning — verify dimensions and compatibility with your existing setup.`
    );
  }

  let category = 'GOOD CHOICE';
  const regretShieldFlags = [];

  if (shoppingObjective) {
    const objLower = shoppingObjective.toLowerCase();
    const prodText = `${product.name} ${product.description || ''} ${(product.tags || []).join(' ')} ${useCases.join(' ')}`.toLowerCase();
    const parsedBudget = parseBudget(shoppingObjective).budget;

    if (parsedBudget && product.price > parsedBudget) {
      category = 'MIXED FEEDBACK';
      regretShieldFlags.push(
        `Single-item price (${priceFormatted}) exceeds your stated "${shoppingObjective}" budget target of ₹${parsedBudget.toLocaleString('en-IN')}.`
      );
    }
    if ((objLower.includes('quiet') || objLower.includes('hostel') || objLower.includes('library')) &&
        (prodText.includes('clicky') || prodText.includes('blue switch') || prodText.includes('outemu'))) {
      category = 'MIXED FEEDBACK';
      regretShieldFlags.push(
        `AI Spec Alert: Mechanical switch acoustics may be noticeable in quiet or shared "${shoppingObjective}" environments.`
      );
    }
    if (regretShieldFlags.length === 0) {
      regretShieldFlags.push(
        `AI Spec & Suitability Check: ${product.name} specifications align well with your "${shoppingObjective}" objective.`
      );
    }
  } else {
    regretShieldFlags.push(
      `AI Spec & Value Check: ${brand} ${product.name} offers balanced specifications for its ${priceFormatted} ${categoryName} tier.`
    );
  }

  const topSpecHighlight = attrs.length > 0
    ? attrs.slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(', ')
    : `${categoryName} build`;

  return {
    productId: product._id.toString(),
    productName: product.name,
    category,
    headline:
      category === 'GOOD CHOICE'
        ? `AI Specification & Value Assessment: Strong ${brand} ${categoryName.toLowerCase()} choice (${topSpecHighlight}).`
        : `AI Specification & Value Assessment: Solid core specs with trade-offs to note for your objective.`,
    positiveThemes,
    negativeThemes: commonComplaints,
    commonComplaints,
    strengths: positiveThemes,
    concerns: commonComplaints,
    limitations: `AI-generated evaluation synthesized from ${brand} technical specifications, category benchmarks, and ${priceFormatted} price positioning (0 customer reviews recorded yet).`,
    regretShieldFlags,
    reviewBreakdown: {
      ...stats,
      aiSynthesized: true
    }
  };
}

function analyzeSingleProductReviews(product, reviews, stats, shoppingObjective) {
  const totalReviews = stats.totalReviewCount;
  if (totalReviews === 0) {
    return synthesizeAiProductReviewFromSpecs(product, stats, shoppingObjective);
  }

  const effectiveAvg = stats.genuineRating !== null ? stats.genuineRating : stats.demoRating;
  const highReviews = reviews.filter(r => r.rating >= 4);
  const lowReviews = reviews.filter(r => r.rating <= 2);
  const midReviews = reviews.filter(r => r.rating === 3);

  let category = 'GOOD CHOICE';
  if (effectiveAvg <= 2.8 || (lowReviews.length >= highReviews.length && lowReviews.length > 0)) {
    category = 'CAUTION';
  } else if (effectiveAvg < 4.0 || (lowReviews.length > 0 && highReviews.length > 0) || midReviews.length > 0) {
    category = 'MIXED FEEDBACK';
  }

  const positiveThemes = highReviews.map(r => r.title);
  const negativeThemes = [...lowReviews, ...midReviews].map(r => r.title);
  const commonComplaints = [...lowReviews, ...midReviews].map(r => r.text);
  const strengths = highReviews.length > 0
    ? highReviews.map(r => r.text)
    : [`Priced competitively at ₹${product.price.toLocaleString('en-IN')} in ${product.category}.`];

  const concerns = lowReviews.length > 0 || midReviews.length > 0
    ? [...lowReviews, ...midReviews].map(r => r.title)
    : [];

  // Regret Shield checks against stated objective
  const regretShieldFlags = [];
  if (category === 'CAUTION') {
    regretShieldFlags.push(`Repeated reviewer complaints reported (${lowReviews.length} low-rated review${lowReviews.length === 1 ? '' : 's'}).`);
  }
  if (shoppingObjective) {
    const objLower = shoppingObjective.toLowerCase();
    const prodText = `${product.name} ${product.description} ${commonComplaints.join(' ')}`.toLowerCase();
    if ((objLower.includes('hostel') || objLower.includes('quiet') || objLower.includes('study')) && prodText.includes('loud')) {
      regretShieldFlags.push('Reviewers note audible switch noise, which may disturb roommates in shared hostel or quiet study spaces.');
    }
    if ((objLower.includes('work') || objLower.includes('wfh') || objLower.includes('gaming') || objLower.includes('long')) &&
        (prodText.includes('short study') || prodText.includes('no lower back') || prodText.includes('clamping'))) {
      regretShieldFlags.push(`Reviewers report comfort fatigue during extended sessions, which conflicts with "${shoppingObjective}".`);
    }
  }

  const sourceNote = stats.genuineReviewCount > 0
    ? `Based on ${stats.genuineReviewCount} genuine customer review(s) (${stats.verifiedPurchaseCount} verified purchase) and ${stats.demoReviewCount} demo review(s).`
    : `Based on ${stats.demoReviewCount} seeded DEMO review(s) (0 genuine customer reviews yet).`;

  return {
    productId: product._id.toString(),
    productName: product.name,
    category,
    headline: category === 'GOOD CHOICE'
      ? `Strong buyer feedback (${effectiveAvg}/5 avg across ${totalReviews} review${totalReviews === 1 ? '' : 's'}).`
      : category === 'CAUTION'
      ? `Caution advised: reviewers highlighted recurring comfort or build concerns (${effectiveAvg}/5 avg).`
      : `Mixed feedback (${effectiveAvg}/5 avg): solid core value with notable trade-offs to consider.`,
    positiveThemes,
    negativeThemes,
    commonComplaints,
    strengths,
    concerns,
    limitations: sourceNote,
    regretShieldFlags,
    reviewBreakdown: stats
  };
}

function getProductKnownTradeOffs(product) {
  if (!product) return [];
  const list = [];
  const base = buildProductLimitation(product);
  if (base) list.push(base);

  const priceFormatted = `₹${Number(product.price || 0).toLocaleString('en-IN')}`;
  if (product.price >= 15000) {
    list.push(`Higher upfront cost (${priceFormatted}) — best suited if you need its full specification tier.`);
  } else if (product.price <= 1500) {
    list.push(`Entry-level budget build (${priceFormatted}) — focuses on core everyday utility rather than premium materials.`);
  } else {
    list.push(`Mid-tier ${ (product.category || 'product').toLowerCase() } — verify workspace dimensions and port/socket compatibility.`);
  }
  return list;
}

module.exports = {
  extractShoppingIntent,
  buildFallbackShoppingProposal,
  evaluateFallbackNegotiation,
  analyzeSingleProductReviews,
  synthesizeAiProductReviewFromSpecs,
  getProductSlotCategory,
  buildProductLimitation,
  getProductKnownTradeOffs
};

