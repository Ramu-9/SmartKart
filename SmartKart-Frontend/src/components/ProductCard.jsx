import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Star, ShoppingBag } from 'lucide-react';
import { wishlistApi } from '../services/api';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { handleImageError } from '../utils/imageFallback';

const ProductCard = ({ product, isWishlisted: initialWishlisted, onWishlistToggle }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(initialWishlisted);
  const [isAddingLocal, setIsAddingLocal] = useState(false);

  const { addToCart, isInCart, actionLoading } = useCart();

  const inCart = isInCart(product._id);
  const isAdding = isAddingLocal || actionLoading[product._id] === 'adding';

  useEffect(() => {
    setIsWishlisted(initialWishlisted);
  }, [initialWishlisted]);

  const handleToggleWishlist = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const response = await wishlistApi.patch(`/${product._id}/toggle`);
      const { saved } = response.data;

      setIsWishlisted(saved);
      if (onWishlistToggle) {
        onWishlistToggle(product._id, saved);
      }

      window.dispatchEvent(new Event('wishlistUpdated'));
      showToast(
        saved
          ? `Saved "${product.name}" to your wishlist`
          : `Removed "${product.name}" from wishlist`,
        saved ? 'success' : 'info'
      );
    } catch {
      showToast('Please sign in or click "Try Demo Account" to save items to your wishlist', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddToCart = async () => {
    if (isAdding || product.stock <= 0) return;
    setIsAddingLocal(true);
    try {
      const result = await addToCart(product._id);
      if (!result.success) {
        if (result.status === 401) {
          showToast('Please sign in or try the Demo Account to add items to your cart', 'error');
          navigate('/login');
        } else {
          showToast(result.message || 'Unable to add item to cart', 'error');
        }
      } else {
        showToast(
          inCart
            ? `Added another "${product.name}" to your cart`
            : `Added "${product.name}" to your cart`,
          'success'
        );
      }
    } catch {
      showToast('Please sign in to add items to your cart', 'error');
    } finally {
      setIsAddingLocal(false);
    }
  };

  const stock = Number(product.stock || 0);
  const stockLabel =
    stock <= 0
      ? 'Out of stock'
      : stock <= 5
      ? `Only ${stock} left`
      : `In stock (${stock})`;

  const stockToneClass =
    stock <= 0 ? 'out' : stock <= 5 ? 'low' : 'in';

  const hasGenuineRating =
    product.genuineRating !== null &&
    product.genuineRating !== undefined &&
    Number(product.genuineReviewCount || 0) > 0;

  return (
    <article className="product-card">
      <div className="product-image-wrapper">
        <Link to={`/products/${product._id}`} aria-label={product.name}>
          <img
            src={product.image}
            alt={product.name}
            referrerPolicy="no-referrer"
            className="product-image"
            loading="lazy"
            onError={handleImageError}
          />
        </Link>
        <button
          type="button"
          className={`wishlist-icon-btn ${isWishlisted ? 'active' : ''}`}
          onClick={handleToggleWishlist}
          disabled={isSaving}
          title={isWishlisted ? 'Remove from Wishlist' : 'Save to Wishlist'}
          aria-label={isWishlisted ? 'Remove from Wishlist' : 'Save to Wishlist'}
        >
          <Heart
            size={16}
            fill={isWishlisted ? '#EF4444' : 'none'}
            color={isWishlisted ? '#EF4444' : 'currentColor'}
            strokeWidth={2}
          />
        </button>
      </div>

      <div className="product-info">
        <div className="product-meta-top">
          <span className="product-category">
            {product.brand ? `${product.brand} · ` : ''}
            {product.category}
          </span>
        </div>

        <Link to={`/products/${product._id}`} className="product-name-link">
          <h3 className="product-name">{product.name}</h3>
        </Link>

        {/* Star rating + genuine review count (DEMO reviews strictly excluded) */}
        <div className="product-rating-row" aria-label="Customer rating">
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
      </div>
    </article>
  );
};

export default ProductCard;
