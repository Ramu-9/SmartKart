// Centralized UI Copy & Friendly Feature Labels for SmartKart
// Keep internal API route names unchanged; update display strings here.

export const UI_STRINGS = {
  brandName: 'SmartKart',

  // 1A. Plain, friendly feature names
  shopByGoal: 'Shop by Goal',
  suggestedBundle: 'Your Suggested Bundle',
  crossSellTitle: 'Customers also add this',
  checkMyCart: 'Check My Cart',
  smartPurchaseCheck: 'Smart Purchase Check',
  swapForThis: 'Swap for this',
  askForDiscount: 'Ask for a Discount',
  tryDemoAccount: 'Try Demo Account',
  sampleReviewsHeading: 'Sample reviews (not from real customers)',
  verifiedPurchaseBadge: 'Verified Purchase',
  customerReviewBadge: 'Customer Review',

  // Status badges (paired with icons + colors, never color alone)
  statusBadges: {
    'GOOD CHOICE': {
      label: 'Great pick',
      tone: 'emerald'
    },
    RECOMMENDED: {
      label: 'Great pick',
      tone: 'emerald'
    },
    'MIXED FEEDBACK': {
      label: 'Good fit',
      tone: 'amber'
    },
    ACCEPTABLE: {
      label: 'Good fit',
      tone: 'amber'
    },
    CAUTION: {
      label: 'Worth a second look',
      tone: 'red'
    }
  },

  // Dynamic button formatter for bundle approval
  formatAddSelectedToCart: (count, totalINR) => {
    if (!count || count <= 0) return 'Select items to add to cart';
    const itemWord = count === 1 ? 'item' : 'items';
    return `Add ${count} ${itemWord} to cart · ₹${ Number(totalINR || 0).toLocaleString('en-IN') }`;
  },

  // Tooltips ("ⓘ" hints)
  tooltips: {
    smartPurchaseCheck:
      'Smart Purchase Check inspects verified buyer reviews, product specifications, and known trade-offs for every item in your cart, and suggests better-fitting alternatives if needed.',
    askForDiscount:
      'Buying multiple items or a complete setup? Ask for a bundle discount. Approved discounts are capped at 15% and locked to your current cart items.',
    temporaryBundle:
      'Your Suggested Bundle is a scratchpad. Adjusting quantities or unchecking items here never changes your actual cart until you click Add to cart.'
  },

  // Checkout test mode banner
  testModeBanner:
    'Razorpay Payment Gateway Connected · Test Mode: no real money charged (UPI QR Scanner, UPI ID & Cards ready).',

  // Home page hero
  homeHeroTitle: 'Find the right gear for your space and budget.',
  homeHeroSubtitle:
    'Describe what you are setting up in plain English to get a ready-to-edit bundle within your budget, or browse our 38-product catalogue directly.',
  homePromptPlaceholder: 'Describe what you need (e.g., Home gym under ₹10,000)...',
  homeExampleChips: [
    'Home gym & fitness essentials under ₹10,000',
    'Hostel room setup under ₹5,000',
    'Gaming desk setup under ₹30,000',
    'Quiet work-from-home setup under ₹15,000'
  ]
};

export default UI_STRINGS;
