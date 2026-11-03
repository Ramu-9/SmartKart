import { useState, useEffect, useCallback, useMemo } from 'react';
import { Star, Edit3, Trash2, CheckCircle2, MessageSquare, Info } from 'lucide-react';
import api, { reviewApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import UI_STRINGS from '../constants/uiStrings';

function ProductReviewsSection({ productId }) {
  const { showToast } = useToast();
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const [editingReviewId, setEditingReviewId] = useState(null);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');

  const fetchReviewsAndUser = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [revRes, userRes] = await Promise.allSettled([
        reviewApi.get(`/product/${productId}`),
        api.get('/me')
      ]);

      if (revRes.status === 'fulfilled') {
        setReviews(revRes.value.data.reviews || []);
        setStats(revRes.value.data.stats || null);
      } else {
        setError('Unable to load product reviews.');
      }

      if (userRes.status === 'fulfilled') {
        setCurrentUser(userRes.value.data);
      } else {
        setCurrentUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    if (productId) {
      fetchReviewsAndUser();
    }
  }, [productId, fetchReviewsAndUser]);

  const myExistingReview = currentUser
    ? reviews.find((r) => r.customer && r.customer.toString() === currentUser._id?.toString())
    : null;

  // Group strictly in required order:
  // 1) Verified Purchase reviews first
  // 2) Customer reviews (unverified) second
  // 3) Sample reviews (DEMO) last
  const { verifiedReviews, customerReviews, sampleDemoReviews } = useMemo(() => {
    const verified = [];
    const customer = [];
    const demo = [];

    reviews.forEach((r) => {
      if (r.source === 'VERIFIED_PURCHASE') {
        verified.push(r);
      } else if (r.source === 'DEMO') {
        demo.push(r);
      } else {
        customer.push(r);
      }
    });

    return {
      verifiedReviews: verified,
      customerReviews: customer,
      sampleDemoReviews: demo
    };
  }, [reviews]);

  const handleStartEdit = (rev) => {
    setEditingReviewId(rev._id);
    setRating(rev.rating);
    setTitle(rev.title);
    setText(rev.text);
    setFormError('');
    setFormSuccess('');
  };

  const handleCancelEdit = () => {
    setEditingReviewId(null);
    setRating(5);
    setTitle('');
    setText('');
    setFormError('');
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setSubmitting(true);

    try {
      if (editingReviewId) {
        const res = await reviewApi.patch(`/${editingReviewId}`, {
          rating: Number(rating),
          title,
          text
        });
        setStats(res.data.stats);
        setFormSuccess('Your review has been updated.');
        showToast('Review updated', 'success');
        setEditingReviewId(null);
      } else {
        const res = await reviewApi.post(`/product/${productId}`, {
          rating: Number(rating),
          title,
          text
        });
        setStats(res.data.stats);
        setFormSuccess('Thank you! Your review has been published.');
        showToast('Review published', 'success');
      }
      setTitle('');
      setText('');
      setRating(5);
      const refreshed = await reviewApi.get(`/product/${productId}`);
      setReviews(refreshed.data.reviews || []);
      setStats(refreshed.data.stats || null);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Unable to submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReview = async (reviewId) => {
    setFormError('');
    setFormSuccess('');
    try {
      await reviewApi.delete(`/${reviewId}`);
      setFormSuccess('Your review was deleted.');
      showToast('Review deleted', 'info');
      setConfirmDeleteId(null);
      if (editingReviewId === reviewId) {
        handleCancelEdit();
      }
      const refreshed = await reviewApi.get(`/product/${productId}`);
      setReviews(refreshed.data.reviews || []);
      setStats(refreshed.data.stats || null);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Unable to delete review.');
    }
  };

  const renderReviewCard = (rev) => {
    const isOwn =
      currentUser && rev.customer && rev.customer.toString() === currentUser._id?.toString();
    const isVerified = rev.source === 'VERIFIED_PURCHASE';
    const isDemo = rev.source === 'DEMO';

    return (
      <article key={rev._id} className={`review-item-card ${isDemo ? 'demo-review-card' : ''}`}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '1rem',
            flexWrap: 'wrap'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '1.02rem' }}>{rev.title}</strong>

              {isVerified && (
                <span className="verified-purchase-green-badge">
                  <CheckCircle2 size={13} />
                  <span>{UI_STRINGS.verifiedPurchaseBadge}</span>
                </span>
              )}

              {!isVerified && !isDemo && (
                <span className="customer-review-badge">
                  <MessageSquare size={12} />
                  <span>{UI_STRINGS.customerReviewBadge}</span>
                </span>
              )}

              {isDemo && (
                <span className="sample-review-tag">
                  <Info size={12} />
                  <span>Sample review (excluded from rating)</span>
                </span>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                marginTop: '0.3rem',
                fontSize: '0.82rem',
                color: 'var(--text-muted)'
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  color: '#D97706',
                  fontWeight: 700
                }}
              >
                <Star size={14} fill="#D97706" color="#D97706" /> {rev.rating}/5
              </span>
              <span>·</span>
              <span>{rev.authorName || 'Customer'}</span>
              {rev.createdAt && (
                <>
                  <span>·</span>
                  <span>{new Date(rev.createdAt).toLocaleDateString('en-IN')}</span>
                </>
              )}
            </div>
          </div>

          {isOwn && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-outline"
                style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}
                onClick={() => handleStartEdit(rev)}
              >
                <Edit3 size={14} />
                <span>Edit</span>
              </button>
              {confirmDeleteId === rev._id ? (
                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.76rem',
                      background: 'var(--error-color)'
                    }}
                    onClick={() => handleDeleteReview(rev._id)}
                  >
                    Confirm Delete
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.76rem' }}
                    onClick={() => setConfirmDeleteId(null)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem', color: '#B91C1C' }}
                  onClick={() => setConfirmDeleteId(rev._id)}
                >
                  <Trash2 size={14} />
                  <span>Delete</span>
                </button>
              )}
            </div>
          )}
        </div>

        <p
          style={{
            marginTop: '0.65rem',
            color: 'var(--text-main)',
            fontSize: '0.94rem',
            lineHeight: 1.55
          }}
        >
          {rev.text}
        </p>
      </article>
    );
  };

  return (
    <section className="product-reviews-section">
      <div className="reviews-header-block">
        <div>
          <h3 style={{ fontSize: '1.6rem', marginBottom: '0.25rem' }}>
            Customer Reviews &amp; Ratings
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Product ratings are calculated strictly from real customer reviews.{' '}
            {UI_STRINGS.sampleReviewsHeading} are shown separately at the bottom and never count
            toward the star rating.
          </p>
        </div>

        {stats && (
          <div className="reviews-stats-strip">
            <div className="review-stat-cell">
              <span className="review-stat-label">Customer Rating</span>
              <span className="review-stat-val">
                {stats.genuineRating !== null
                  ? `${stats.genuineRating} / 5`
                  : 'No customer ratings yet'}
              </span>
            </div>
            <div className="review-stat-cell">
              <span className="review-stat-label">{UI_STRINGS.verifiedPurchaseBadge}</span>
              <span className="review-stat-val">{stats.verifiedPurchaseCount}</span>
            </div>
            <div className="review-stat-cell">
              <span className="review-stat-label">Customer Reviews</span>
              <span className="review-stat-val">{stats.unverifiedCustomerCount}</span>
            </div>
            <div className="review-stat-cell">
              <span className="review-stat-label">Sample Reviews (Excluded)</span>
              <span className="review-stat-val">{stats.demoReviewCount}</span>
            </div>
          </div>
        )}
      </div>

      {currentUser && (!myExistingReview || editingReviewId) && (
        <form onSubmit={handleSubmitReview} className="review-compose-card">
          <h4 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
            {editingReviewId ? 'Edit Your Review' : 'Write a Customer Review'}
          </h4>

          {formError && (
            <div className="checkout-error-banner" style={{ marginBottom: '1rem' }}>
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="ai-status-banner" style={{ marginBottom: '1rem' }}>
              <span>{formSuccess}</span>
            </div>
          )}

          <div className="form-row" style={{ marginBottom: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="review-rating">
                Rating (1 to 5)
              </label>
              <select
                id="review-rating"
                className="form-input"
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                disabled={submitting}
              >
                <option value={5}>5 — Excellent</option>
                <option value={4}>4 — Good</option>
                <option value={3}>3 — Average / Mixed</option>
                <option value={2}>2 — Below Expectations</option>
                <option value={1}>1 — Poor</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
              <label className="form-label" htmlFor="review-title">
                Review Headline
              </label>
              <input
                id="review-title"
                type="text"
                className="form-input"
                placeholder="Summarize your experience in a short headline"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                minLength={3}
                maxLength={150}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="review-text">
              Detailed Review
            </label>
            <textarea
              id="review-text"
              className="form-input"
              rows={3}
              placeholder="Share what worked well, any trade-offs, and how it fits your setup..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
              minLength={5}
              maxLength={2000}
              disabled={submitting}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: 'auto' }}
              disabled={submitting}
            >
              {submitting ? 'Saving...' : editingReviewId ? 'Save Changes' : 'Submit Review'}
            </button>
            {editingReviewId && (
              <button type="button" className="btn btn-outline" onClick={handleCancelEdit}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {formSuccess && myExistingReview && !editingReviewId && (
        <div className="ai-status-banner" style={{ marginBottom: '1rem' }}>
          <span>{formSuccess}</span>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '2rem 0', color: 'var(--text-muted)' }}>Loading reviews...</div>
      ) : error ? (
        <div style={{ padding: '1rem 0', color: '#b91c1c' }}>{error}</div>
      ) : reviews.length === 0 ? (
        <div className="review-empty-box">
          No customer or sample reviews have been recorded for this product yet. Be the first to
          review it!
        </div>
      ) : (
        <div className="reviews-groups-stack">
          {/* 1. Verified Purchase Reviews First */}
          {verifiedReviews.length > 0 && (
            <div className="reviews-subgroup">
              <h4 className="reviews-subgroup-heading">
                <CheckCircle2 size={16} color="#15803D" />
                <span>Verified Purchase Reviews ({verifiedReviews.length})</span>
              </h4>
              <div className="reviews-list-grid">{verifiedReviews.map(renderReviewCard)}</div>
            </div>
          )}

          {/* 2. Customer Reviews Second */}
          {customerReviews.length > 0 && (
            <div className="reviews-subgroup">
              <h4 className="reviews-subgroup-heading">
                <MessageSquare size={16} />
                <span>Customer Reviews ({customerReviews.length})</span>
              </h4>
              <div className="reviews-list-grid">{customerReviews.map(renderReviewCard)}</div>
            </div>
          )}

          {verifiedReviews.length === 0 && customerReviews.length === 0 && (
            <div className="review-empty-box" style={{ marginBottom: '1.25rem' }}>
              No real customer reviews yet. Purchase this item or sign in to leave the first
              customer review!
            </div>
          )}

          {/* 3. Sample Reviews Last */}
          {sampleDemoReviews.length > 0 && (
            <div className="reviews-subgroup sample-reviews-block">
              <div className="sample-reviews-header">
                <h4 className="reviews-subgroup-heading" style={{ marginBottom: '0.15rem' }}>
                  <Info size={16} />
                  <span>
                    {UI_STRINGS.sampleReviewsHeading} ({sampleDemoReviews.length})
                  </span>
                </h4>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  These pre-loaded sample reviews illustrate how {UI_STRINGS.smartPurchaseCheck}{' '}
                  flags pros and cons. They are never included in the product&apos;s star rating.
                </p>
              </div>
              <div className="reviews-list-grid">{sampleDemoReviews.map(renderReviewCard)}</div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default ProductReviewsSection;
