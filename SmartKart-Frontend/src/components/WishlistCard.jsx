import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Trash2, Star } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { handleImageError } from '../utils/imageFallback';

const WishlistCard = ({ product, onRemove }) => {
  const { addToCart, isInCart, actionLoading } = useCart();
  const { showToast } = useToast();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const inCart = isInCart(product._id);
  const isAdding = actionLoading[product._id] === 'adding';

  const handleAddToCart = async () => {
    if (isAdding || product.stock <= 0) return;
    const res = await addToCart(product._id);
    if (res.success) {
      showToast(`Added "${product.name}" to your cart`, 'success');
    } else {
      showToast(res.message || 'Unable to add to cart', 'error');
    }
  };

  const stock = Number(product.stock || 0);
  const stockLabel =
    stock <= 0 ? 'Out of stock' : stock <= 5 ? `Only ${stock} left` : `In stock (${stock})`;
  const stockToneClass = stock <= 0 ? 'out' : stock <= 5 ? 'low' : 'in';

  const hasGenuineRating =
    product.genuineRating !== null &&
    product.genuineRating !== undefined &&
    Number(product.genuineReviewCount || 0) > 0;

  return (
    <article className="product-card wishlist-card">
      <div className="product-image-wrapper">
        <Link to={`/products/${product._id}`} aria-label={product.name}>
          <img
            src={product.image}
            alt={product.name}
            referrerPolicy="no-referrer"
            className="product-image"
            onError={handleImageError}
          />
        </Link>
      </div>

      <div className="product-info">
        <span className="product-category">
          {product.brand ? `${product.brand} · ` : ''}
          {product.category}
        </span>
        <Link to={`/products/${product._id}`} className="product-name-link">
          <h3 className="product-name">{product.name}</h3>
        </Link>

        <div className="product-rating-row">
          {hasGenuineRating ? (
            <>
              <span className="product-star-badge">
                <Star size={13} fill="#D97706" color="#D97706" />
                <span>{product.genuineRating}</span>
              </span>
              <span className="product-review-count">
                ({product.genuineReviewCount}{' '}
                {product.genuineReviewCount === 1 ? 'review' : 'reviews'})
              </span>
            </>
          ) : (
            <span className="product-no-rating">
              <Star size={13} color="#94A3B8" />
              <span>No customer ratings yet</span>
            </span>
          )}
        </div>

        <div className="product-price-stock-row">
          <p className="product-price">₹{product.price.toLocaleString('en-IN')}</p>
          <span className={`product-stock-tag ${stockToneClass}`}>{stockLabel}</span>
        </div>

        <div
          className="wishlist-actions"
          style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
        >
          <div className="product-card-actions">
            <button
              type="button"
              className="btn btn-primary add-to-cart-btn"
              onClick={handleAddToCart}
              disabled={isAdding || stock <= 0}
            >
              <ShoppingBag size={15} />
              <span>
                {stock <= 0
                  ? 'Out of Stock'
                  : isAdding
                  ? 'Adding...'
                  : inCart
                  ? 'Add Another'
                  : 'Add to Cart'}
              </span>
            </button>

            <Link to={`/products/${product._id}`} className="view-details-btn">
              Details
            </Link>
          </div>

          {confirmRemove ? (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => {
                  onRemove(product._id);
                  showToast(`Removed "${product.name}" from wishlist`, 'info');
                }}
                className="btn btn-primary"
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  fontSize: '0.82rem',
                  background: 'var(--error-color)'
                }}
              >
                Confirm Remove
              </button>
              <button
                type="button"
                onClick={() => setConfirmRemove(false)}
                className="btn btn-outline"
                style={{ flex: 1, padding: '0.5rem', fontSize: '0.82rem' }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmRemove(true)}
              className="btn btn-outline"
              style={{
                width: '100%',
                padding: '0.55rem',
                fontSize: '0.84rem',
                borderColor: 'var(--error-border)',
                color: 'var(--error-color)'
              }}
            >
              <Trash2 size={14} />
              <span>Remove from Wishlist</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
};

export default WishlistCard;
