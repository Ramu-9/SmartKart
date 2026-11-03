import { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  ArrowLeftRight,
  Check,
  X,
  ShieldCheck,
  Info,
  RotateCcw
} from 'lucide-react';
import { aiApi } from '../services/api';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { handleImageError } from '../utils/imageFallback';
import UI_STRINGS from '../constants/uiStrings';

const CATEGORY_STYLES = {
  'GOOD CHOICE': {
    label: UI_STRINGS.statusBadges['GOOD CHOICE'].label,
    bg: '#ECFDF5',
    border: '#A7F3D0',
    text: '#065F46',
    icon: CheckCircle2
  },
  RECOMMENDED: {
    label: UI_STRINGS.statusBadges.RECOMMENDED.label,
    bg: '#ECFDF5',
    border: '#A7F3D0',
    text: '#065F46',
    icon: CheckCircle2
  },
  'MIXED FEEDBACK': {
    label: UI_STRINGS.statusBadges['MIXED FEEDBACK'].label,
    bg: '#FFFBEB',
    border: '#FDE68A',
    text: '#92400E',
    icon: AlertTriangle
  },
  ACCEPTABLE: {
    label: UI_STRINGS.statusBadges.ACCEPTABLE.label,
    bg: '#FFFBEB',
    border: '#FDE68A',
    text: '#92400E',
    icon: AlertTriangle
  },
  CAUTION: {
    label: UI_STRINGS.statusBadges.CAUTION.label,
    bg: '#FEF2F2',
    border: '#FECACA',
    text: '#B91C1C',
    icon: ShieldAlert
  }
};

function CartAiReviewModal({ isOpen, onClose, initialObjective = '' }) {
  const { cart, hasPersistedCartItems, replaceCartProduct } = useCart();
  const { showToast } = useToast();
  const [objective, setObjective] = useState(initialObjective || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reviewData, setReviewData] = useState(null);
  const [expandedCompare, setExpandedCompare] = useState({});
  const [keptProducts, setKeptProducts] = useState({});
  const [confirmReplace, setConfirmReplace] = useState(null);
  const [replaceStatus, setReplaceStatus] = useState('');

  useEffect(() => {
    if (initialObjective) {
      setObjective(initialObjective);
    }
  }, [initialObjective]);

  const runCartReview = useCallback(
    async (e, customObj) => {
      if (e) e.preventDefault();
      if (!hasPersistedCartItems) return;
      setLoading(true);
      setError('');
      try {
        const targetObj = customObj !== undefined ? customObj : objective.trim();
        const response = await aiApi.post('/smart-cart/review', {
          shoppingObjective: targetObj
        });
        setReviewData(response.data.review);
      } catch (err) {
        setError(
          err.response?.data?.message ||
            'Unable to run Check My Cart right now. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    },
    [hasPersistedCartItems, objective]
  );

  // Auto-run review when opened on a non-empty persisted cart
  useEffect(() => {
    if (isOpen && hasPersistedCartItems && !reviewData && !loading) {
      runCartReview(null, initialObjective || objective);
    }
  }, [
    isOpen,
    hasPersistedCartItems,
    reviewData,
    loading,
    initialObjective,
    objective,
    runCartReview
  ]);

  // Non-negotiable visibility guard: never render if persisted cart is empty
  if (!isOpen || !hasPersistedCartItems) {
    return null;
  }

  const toggleCompare = (productId) => {
    setExpandedCompare((prev) => ({
      ...prev,
      [productId]: !prev[productId]
    }));
  };

  const handleKeepProduct = (productId) => {
    setKeptProducts((prev) => ({ ...prev, [productId]: true }));
    setConfirmReplace(null);
    showToast('Keeping current item in your cart', 'info');
  };

  const handleConfirmReplacement = async () => {
    if (!confirmReplace) return;
    const { oldProductId, alternative } = confirmReplace;
    setLoading(true);
    setError('');
    try {
      const res = await replaceCartProduct(oldProductId, alternative._id);
      if (!res.success) {
        setError(res.message);
        showToast(res.message || 'Swap failed', 'error');
      } else {
        const msg = `Swapped for ${alternative.name} (quantity preserved). Re-checking your updated cart.`;
        setReplaceStatus(msg);
        showToast(`Swapped for "${alternative.name}"`, 'success');
        setConfirmReplace(null);
        const refreshed = await aiApi.post('/smart-cart/review', {
          shoppingObjective: objective.trim()
        });
        setReviewData(refreshed.data.review);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Replacement failed.');
    } finally {
      setLoading(false);
    }
  };

  const overallBadge =
    CATEGORY_STYLES[reviewData?.overallCategory] || CATEGORY_STYLES['GOOD CHOICE'];

  return (
    <div
      className="ai-review-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`${UI_STRINGS.checkMyCart} — ${UI_STRINGS.smartPurchaseCheck}`}
    >
      <div className="ai-review-panel">
        <div className="ai-review-header">
          <div>
            <div className="ai-kicker">
              <ShieldCheck size={15} />
              <span>
                {UI_STRINGS.checkMyCart} · {UI_STRINGS.smartPurchaseCheck}
              </span>
            </div>
            <h2 className="ai-review-title">Know what you&apos;re buying before you pay.</h2>
            <p className="ai-review-subtitle">
              Checking {cart.length} {cart.length === 1 ? 'item' : 'items'} in your cart against
              customer reviews, specifications, and known trade-offs.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-outline ai-close-btn"
            onClick={onClose}
            aria-label="Close Check My Cart modal"
          >
            <X size={17} />
            <span>Close</span>
          </button>
        </div>

        <form onSubmit={(e) => runCartReview(e)} className="ai-objective-bar">
          <label
            htmlFor="regret-shield-objective"
            className="form-label"
            style={{ marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <span>What will you use these items for? (optional)</span>
            <span
              className="tooltip-trigger"
              title={UI_STRINGS.tooltips.smartPurchaseCheck}
              aria-label={UI_STRINGS.tooltips.smartPurchaseCheck}
            >
              <Info size={14} />
              <span className="tooltip-bubble">{UI_STRINGS.tooltips.smartPurchaseCheck}</span>
            </span>
          </label>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input
              id="regret-shield-objective"
              type="text"
              className="form-input"
              style={{ flex: 1, minWidth: '240px' }}
              placeholder='e.g., "Quiet hostel study room" or "Long 8-hour work sessions"'
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              disabled={loading}
            />
            <button type="submit" className="btn btn-ai btn-inline" disabled={loading}>
              {loading
                ? 'Checking Cart...'
                : reviewData
                ? 'Re-Check Cart'
                : UI_STRINGS.checkMyCart}
            </button>
          </div>
        </form>

        {error && (
          <div className="checkout-error-banner" style={{ marginBottom: 0 }}>
            <span>{error}</span>
            <button
              type="button"
              className="btn btn-outline btn-sm-inline"
              style={{ marginLeft: 'auto' }}
              onClick={(e) => runCartReview(e)}
            >
              <RotateCcw size={14} />
              <span>Retry</span>
            </button>
          </div>
        )}

        {replaceStatus && (
          <div className="ai-status-banner">
            <Check size={16} />
            <span>{replaceStatus}</span>
          </div>
        )}

        {loading && !reviewData && (
          <div className="ai-review-ZeroState" aria-busy="true">
            <div className="loading-spinner"></div>
            <p style={{ fontWeight: 600 }}>
              Running {UI_STRINGS.smartPurchaseCheck} on your cart items...
            </p>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
              Comparing verified customer feedback, specifications, and better-fitting alternatives.
            </p>
          </div>
        )}

        {reviewData && (
          <div className="ai-review-results">
            <div className="ai-overall-summary-box">
              <div className="ai-overall-top">
                <strong>
                  Overall Cart Verdict: {overallBadge?.label || reviewData.overallCategory}
                </strong>
                <span className="proposal-engine-pill">
                  {UI_STRINGS.smartPurchaseCheck}
                </span>
              </div>
              <p style={{ color: 'var(--text-main)', fontSize: '0.94rem' }}>
                {reviewData.overallSummary}
              </p>
            </div>

            <div className="ai-review-items-list">
              {reviewData.items.map((item) => {
                const style =
                  CATEGORY_STYLES[item.category] || CATEGORY_STYLES['GOOD CHOICE'];
                const IconComp = style.icon;
                const isComparing = Boolean(expandedCompare[item.productId]);
                const isKept = Boolean(keptProducts[item.productId]);
                const stats = item.reviewBreakdown || {};

                return (
                  <article key={item.productId} className="ai-review-item-card">
                    <div className="ai-review-item-top">
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <img
                          src={item.image}
                          alt={item.productName}
                          referrerPolicy="no-referrer"
                          onError={handleImageError}
                          style={{
                            width: '68px',
                            height: '68px',
                            objectFit: 'cover',
                            background: '#F8FAFC',
                            borderRadius: '10px',
                            border: '1px solid var(--border-subtle)'
                          }}
                        />
                        <div>
                          <h3 style={{ fontSize: '1.15rem', marginBottom: '0.2rem' }}>
                            {item.productName}
                          </h3>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            <strong>₹{(item.price || 0).toLocaleString('en-IN')}</strong>
                            <span> · </span>
                            <span>Qty: {item.quantity}</span>
                            <span> · </span>
                            <span>{item.categoryName}</span>
                          </div>
                        </div>
                      </div>

                      {/* Friendly Status Badge: Color + Icon + Friendly Label */}
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.42rem 0.9rem',
                          borderRadius: '8px',
                          background: style.bg,
                          border: `1px solid ${style.border}`,
                          color: style.text,
                          fontWeight: 700,
                          fontSize: '0.82rem'
                        }}
                      >
                        <IconComp size={16} />
                        <span>{style.label}</span>
                      </div>
                    </div>

                    <p
                      style={{
                        fontWeight: 600,
                        marginTop: '0.85rem',
                        marginBottom: '0.55rem',
                        fontSize: '0.96rem'
                      }}
                    >
                      {item.headline}
                    </p>

                    {/* Source-Separated Review & Spec Evidence Strip */}
                    <div className="ai-review-meta-line">
                      {(stats.totalReviewCount || 0) === 0 ? (
                        <span>
                          <strong>Checked against:</strong> Product specifications &amp; category
                          benchmarks (0 customer reviews recorded yet)
                        </span>
                      ) : (
                        <>
                          <span>
                            <strong>Customer Rating:</strong>{' '}
                            {stats.genuineRating !== null && stats.genuineRating !== undefined
                              ? `${stats.genuineRating}/5 (${stats.genuineReviewCount} customer ${
                                  stats.genuineReviewCount === 1 ? 'review' : 'reviews'
                                }, ${stats.verifiedPurchaseCount} verified purchase)`
                              : 'No real customer reviews yet'}
                          </span>
                          <span> · </span>
                          <span>
                            <strong>{UI_STRINGS.sampleReviewsHeading}:</strong>{' '}
                            {stats.demoReviewCount || 0} (excluded from rating)
                          </span>
                        </>
                      )}
                    </div>

                    <div className="ai-review-columns">
                      <div className="ai-pros-card">
                        <h4 className="ai-subhead">What works well</h4>
                        <ul className="ai-bullet-list">
                          {(item.positiveThemes?.length
                            ? item.positiveThemes
                            : item.strengths || []
                          ).map((str, i) => (
                            <li key={i}>{str}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="ai-cons-card">
                        <h4 className="ai-subhead">Known trade-offs &amp; complaints</h4>
                        {item.commonComplaints?.length > 0 || item.concerns?.length > 0 ? (
                          <ul className="ai-bullet-list">
                            {(item.commonComplaints?.length
                              ? item.commonComplaints
                              : item.concerns
                            ).map((c, i) => (
                              <li key={i}>{c}</li>
                            ))}
                          </ul>
                        ) : (
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            No recurring customer complaints recorded.
                          </p>
                        )}
                      </div>
                    </div>

                    {item.regretShieldFlags && item.regretShieldFlags.length > 0 && (
                      <div className="regret-shield-box">
                        <strong>{UI_STRINGS.smartPurchaseCheck} Notes:</strong>
                        <ul className="ai-bullet-list" style={{ marginTop: '0.35rem' }}>
                          {item.regretShieldFlags.map((flag, idx) => (
                            <li key={idx}>{flag}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Better-Fitting Alternatives & "Swap for this" */}
                    {item.alternatives && item.alternatives.length > 0 && (
                      <div className="ai-alternatives-section">
                        <div className="ai-alt-header-bar">
                          <div>
                            <h4 style={{ fontSize: '1.02rem', fontWeight: 700 }}>
                              Suggested Alternatives ({item.alternatives.length})
                            </h4>
                            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                              Keep your current item or swap it in 1 click (keeps your quantity of{' '}
                              {item.quantity}).
                            </p>
                          </div>

                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="btn btn-outline btn-inline"
                              style={{ padding: '0.48rem 0.9rem', fontSize: '0.8rem' }}
                              onClick={() => handleKeepProduct(item.productId)}
                            >
                              {isKept ? '✓ Keeping Current Item' : 'Keep Current Item'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline btn-inline"
                              style={{ padding: '0.48rem 0.9rem', fontSize: '0.8rem' }}
                              onClick={() => toggleCompare(item.productId)}
                            >
                              <ArrowLeftRight size={14} />
                              <span>{isComparing ? 'Hide Comparison' : 'Compare Specs'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Destructive / Swap Confirmation Banner */}
                        {confirmReplace && confirmReplace.oldProductId === item.productId && (
                          <div className="replace-confirm-banner">
                            <div>
                              <strong>Confirm Swap:</strong> Swap <em>{item.productName}</em> (Qty:{' '}
                              {item.quantity}) for <em>{confirmReplace.alternative.name}</em> at ₹
                              {confirmReplace.alternative.price.toLocaleString('en-IN')} each?
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button
                                type="button"
                                className="btn btn-primary btn-inline"
                                style={{ padding: '0.45rem 0.95rem', fontSize: '0.8rem' }}
                                onClick={handleConfirmReplacement}
                                disabled={loading}
                              >
                                Yes, {UI_STRINGS.swapForThis}
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline btn-inline"
                                style={{ padding: '0.45rem 0.95rem', fontSize: '0.8rem' }}
                                onClick={() => setConfirmReplace(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="ai-alternatives-grid">
                          {item.alternatives.map((alt) => (
                            <div key={alt._id} className="ai-alt-card">
                              <div
                                style={{
                                  display: 'flex',
                                  gap: '0.75rem',
                                  alignItems: 'center',
                                  marginBottom: '0.65rem'
                                }}
                              >
                                <img
                                  src={alt.image}
                                  alt={alt.name}
                                  referrerPolicy="no-referrer"
                                  onError={handleImageError}
                                  style={{
                                    width: '56px',
                                    height: '56px',
                                    objectFit: 'cover',
                                    background: '#F8FAFC',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-subtle)'
                                  }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  {alt.brand && (
                                    <span
                                      style={{
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        color: 'var(--text-muted)'
                                      }}
                                    >
                                      {alt.brand}
                                    </span>
                                  )}
                                  <div
                                    style={{
                                      fontWeight: 700,
                                      fontSize: '0.95rem',
                                      lineHeight: 1.25
                                    }}
                                  >
                                    {alt.name}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: '0.84rem',
                                      fontWeight: 700,
                                      color: 'var(--text-main)',
                                      marginTop: '0.15rem'
                                    }}
                                  >
                                    ₹{alt.price.toLocaleString('en-IN')} · {alt.stock} in stock
                                  </div>
                                </div>
                              </div>

                              <p
                                style={{
                                  fontSize: '0.82rem',
                                  color: 'var(--text-main)',
                                  marginBottom: '0.5rem'
                                }}
                              >
                                <strong>Why this?</strong> {alt.whyItSuitsYou}
                              </p>

                              {isComparing && alt.comparison && (
                                <div className="alt-comparison-box">
                                  <div>
                                    <strong>Price Difference:</strong>{' '}
                                    {alt.comparison.priceDelta > 0
                                      ? `+₹${alt.comparison.priceDelta.toLocaleString('en-IN')} vs current`
                                      : alt.comparison.priceDelta < 0
                                      ? `Saves ₹${Math.abs(
                                          alt.comparison.priceDelta
                                        ).toLocaleString('en-IN')} per unit`
                                      : 'Same price'}
                                  </div>
                                  <div style={{ marginTop: '0.25rem' }}>
                                    <strong>Strengths:</strong>{' '}
                                    {(alt.mainStrengths || []).join('; ')}
                                  </div>
                                  <div style={{ marginTop: '0.25rem' }}>
                                    <strong>Trade-Off:</strong>{' '}
                                    {alt.comparison.tradeOffExplanation}
                                  </div>
                                </div>
                              )}

                              <button
                                type="button"
                                className="btn btn-primary"
                                style={{
                                  width: '100%',
                                  padding: '0.55rem 0.85rem',
                                  fontSize: '0.82rem',
                                  marginTop: 'auto'
                                }}
                                onClick={() => {
                                  setKeptProducts((prev) => ({
                                    ...prev,
                                    [item.productId]: false
                                  }));
                                  setConfirmReplace({
                                    oldProductId: item.productId,
                                    alternative: alt
                                  });
                                }}
                              >
                                {UI_STRINGS.swapForThis}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CartAiReviewModal;
