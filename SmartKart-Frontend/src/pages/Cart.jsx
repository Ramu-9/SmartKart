import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ShieldCheck,
  Truck,
  Sparkles,
  Tag,
  Info,
  X,
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import CartItem from '../components/CartItem';
import CartAiReviewModal from '../components/CartAiReviewModal';
import UI_STRINGS from '../constants/uiStrings';

const Cart = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const {
    cart,
    loading,
    error,
    subtotal,
    discountPercent,
    discountAmount,
    finalTotal,
    activeDiscountOffer,
    discountInvalidatedNotice,
    dismissDiscountInvalidatedNotice,
    removeDiscountOffer,
    lastShoppingObjective,
    totalCount,
    hasPersistedCartItems,
    fetchCart,
    negotiateDiscount
  } = useCart();

  const [isAiReviewOpen, setIsAiReviewOpen] = useState(false);
  const [negotiationMsg, setNegotiationMsg] = useState('');
  const [negotiating, setNegotiating] = useState(false);
  const [negotiationResultMsg, setNegotiationResultMsg] = useState('');

  const handleNegotiate = async (e) => {
    e.preventDefault();
    if (!hasPersistedCartItems) return;
    setNegotiating(true);
    setNegotiationResultMsg('');
    const res = await negotiateDiscount(
      negotiationMsg.trim() || 'Can I get a bundle discount on my cart?'
    );
    setNegotiating(false);
    setNegotiationResultMsg(res.message || '');
    if (res.success && res.approved) {
      showToast(
        `Discount applied: ${res.discountPercent}% off (−₹${Number(
          res.discountAmount || 0
        ).toLocaleString('en-IN')})`,
        'success'
      );
    } else if (!res.success) {
      showToast(res.message || 'Could not apply discount', 'error');
    }
  };

  const handleRemoveDiscount = async () => {
    await removeDiscountOffer();
    setNegotiationResultMsg('');
    showToast('Discount code removed', 'info');
  };

  if (loading) {
    return (
      <div className="cart-page-container" aria-busy="true">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <h2>Loading your cart...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cart-page-container">
        <div className="error-state">
          <AlertCircle size={32} style={{ margin: '0 auto 0.75rem', color: 'var(--error-color)' }} />
          <h2>Unable to load your cart</h2>
          <p style={{ margin: '0.75rem 0 1.25rem' }}>{error}</p>
          <button className="btn btn-primary btn-inline" onClick={fetchCart}>
            <RotateCcw size={15} />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="cart-page-container">
        <div className="cart-empty-state">
          <div className="empty-cart-icon">🛒</div>
          <h2>Your shopping cart is empty</h2>
          <p className="empty-cart-subtitle">
            Browse our 38-item catalogue directly or describe what you need in{' '}
            {UI_STRINGS.shopByGoal} to build a suggested bundle.
          </p>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '0.85rem',
              flexWrap: 'wrap'
            }}
          >
            <Link to="/products" className="btn btn-primary btn-inline">
              Browse Catalogue
            </Link>
            <Link to="/smart-shop" className="btn btn-ai btn-inline">
              <Sparkles size={16} />
              <span>{UI_STRINGS.shopByGoal}</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page-container">
      <div className="cart-page-header">
        <div>
          <span className="section-eyebrow">Shopping Cart</span>
          <h2>
            Your Cart ({totalCount} {totalCount === 1 ? 'item' : 'items'})
          </h2>
        </div>
        <div className="cart-header-actions">
          <Link to="/products" className="continue-shopping-link">
            &larr; Continue Shopping
          </Link>
        </div>
      </div>

      {/* Two-Column Cart Layout: Left = Check My Cart + Cart Items | Right = Sticky Order Summary with Ask for a Discount */}
      <div className="cart-layout">
        {/* LEFT COLUMN */}
        <div className="cart-items-section">
          {/* "Check My Cart" placed directly above the items (strictly visible ONLY when persisted cart has >= 1 item) */}
          {hasPersistedCartItems && (
            <div className="check-my-cart-bar">
              <div className="check-my-cart-copy">
                <div className="check-my-cart-title-row">
                  <ShieldCheck size={18} color="var(--accent-ai)" />
                  <strong>{UI_STRINGS.smartPurchaseCheck}</strong>
                  <span
                    className="tooltip-trigger"
                    title={UI_STRINGS.tooltips.smartPurchaseCheck}
                    aria-label={UI_STRINGS.tooltips.smartPurchaseCheck}
                  >
                    <Info size={14} />
                    <span className="tooltip-bubble">
                      {UI_STRINGS.tooltips.smartPurchaseCheck}
                    </span>
                  </span>
                </div>
                <p>
                  Check your cart items for honest trade-offs, verified buyer ratings, and
                  better-fitting alternatives before checkout.
                </p>
              </div>

              <button
                type="button"
                className="smartkart-ai-review-btn"
                onClick={() => setIsAiReviewOpen(true)}
              >
                <ShieldCheck size={16} />
                <span>{UI_STRINGS.checkMyCart}</span>
              </button>
            </div>
          )}

          {/* Cart Items List */}
          {cart.map((item) => (
            <CartItem key={item.product?._id || item._id} item={item} />
          ))}
        </div>

        {/* RIGHT COLUMN: Sticky Order Summary with "Ask for a Discount" inside */}
        <aside className="order-summary-sidebar">
          <div className="order-summary-card">
            <h3 className="summary-title">Order Summary</h3>

            <div className="summary-row">
              <span className="summary-label">
                Subtotal ({totalCount} {totalCount === 1 ? 'unit' : 'units'}):
              </span>
              <span className="summary-value">₹{subtotal.toLocaleString('en-IN')}</span>
            </div>

            <div className="summary-row">
              <span className="summary-label">Shipping:</span>
              <span className="summary-value shipping-free">FREE</span>
            </div>

            {/* Clear message when a previous discount became invalid because the cart changed */}
            {discountInvalidatedNotice && (
              <div className="discount-invalidated-alert" role="alert">
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{discountInvalidatedNotice}</span>
                <button
                  type="button"
                  className="discount-alert-dismiss"
                  onClick={dismissDiscountInvalidatedNotice}
                  aria-label="Dismiss notice"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Applied Discount Code Row with Remove Option */}
            {activeDiscountOffer && discountAmount > 0 && (
              <div className="applied-discount-box">
                <div className="applied-discount-top">
                  <div className="applied-discount-code-wrap">
                    <Tag size={14} color="#15803D" />
                    <span className="discount-code-pill">
                      {activeDiscountOffer.offerId || `SAVE${discountPercent}`}
                    </span>
                    <span className="applied-discount-pct">({discountPercent}% off)</span>
                  </div>
                  <button
                    type="button"
                    className="remove-discount-btn"
                    onClick={handleRemoveDiscount}
                    aria-label="Remove applied discount"
                  >
                    Remove
                  </button>
                </div>
                <div className="applied-discount-savings-row">
                  <span>Discount Savings:</span>
                  <strong>−₹{discountAmount.toLocaleString('en-IN')}</strong>
                </div>
              </div>
            )}

            {/* "Ask for a Discount" sits inside the summary card, just above the total */}
            <div className="summary-discount-box">
              <div className="summary-discount-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Tag size={14} />
                  <strong>{UI_STRINGS.askForDiscount}</strong>
                </div>
                <span
                  className="tooltip-trigger"
                  title={UI_STRINGS.tooltips.askForDiscount}
                  aria-label={UI_STRINGS.tooltips.askForDiscount}
                >
                  <Info size={14} />
                  <span className="tooltip-bubble">{UI_STRINGS.tooltips.askForDiscount}</span>
                </span>
              </div>

              <form onSubmit={handleNegotiate} className="summary-discount-form">
                <input
                  type="text"
                  className="form-input summary-discount-input"
                  placeholder='e.g., "Can I get 10% off this bundle?"'
                  aria-label={UI_STRINGS.askForDiscount}
                  value={negotiationMsg}
                  onChange={(e) => setNegotiationMsg(e.target.value)}
                  disabled={negotiating}
                />
                <button
                  type="submit"
                  className="btn btn-outline summary-discount-btn"
                  disabled={negotiating}
                >
                  {negotiating ? 'Checking...' : 'Apply'}
                </button>
              </form>

              {negotiationResultMsg && (
                <div
                  className={`cart-negotiation-outcome ${
                    discountAmount > 0 ? 'outcome-ok' : 'outcome-warn'
                  }`}
                >
                  {negotiationResultMsg}
                </div>
              )}
            </div>

            <div className="summary-divider"></div>

            <div className="summary-row summary-total-row">
              <span className="summary-total-label">Total Payable:</span>
              <span className="summary-total-value">₹{finalTotal.toLocaleString('en-IN')}</span>
            </div>

            {/* Single Primary Button: Proceed to Checkout */}
            <button
              type="button"
              className="checkout-btn"
              onClick={() => navigate('/checkout')}
            >
              <span>Proceed to Checkout</span>
              <ArrowRight size={18} />
            </button>

            <div className="summary-trust-badges">
              <div className="trust-badge-item">
                <ShieldCheck size={16} />
                <span>Razorpay Test Mode · Safe Checkout</span>
              </div>
              <div className="trust-badge-item">
                <Truck size={16} />
                <span>Free tracked delivery on all orders</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <CartAiReviewModal
        isOpen={isAiReviewOpen}
        onClose={() => setIsAiReviewOpen(false)}
        initialObjective={lastShoppingObjective}
      />
    </div>
  );
};

export default Cart;
