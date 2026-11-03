import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Layers,
  Compass,
  Heart,
  ShoppingBag,
  Plus,
  Minus,
  ArrowLeft,
  Star,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { productApi, wishlistApi } from '../services/api';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import ProductReviewsSection from '../components/ProductReviewsSection';
import { handleImageError } from '../utils/imageFallback';
import UI_STRINGS from '../constants/uiStrings';

const ProductDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedQty, setSelectedQty] = useState(1);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingLocal, setIsAddingLocal] = useState(false);

  const { addToCart, applyApprovedItems, isInCart, getItemQuantity, actionLoading } = useCart();
  const inCart = isInCart(id);
  const currentCartQty = getItemQuantity(id);
  const isAdding = isAddingLocal || actionLoading[id] === 'adding';

  const fetchProductAndWishlist = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [productRes, wishlistRes] = await Promise.allSettled([
        productApi.get(`/${id}`),
        wishlistApi.get('/')
      ]);
      if (productRes.status === 'fulfilled') {
        setProduct(productRes.value.data);
        setSelectedQty(1);
      } else {
        throw productRes.reason;
      }

      if (wishlistRes.status === 'fulfilled') {
        const isInWishlist = (wishlistRes.value.data.wishlist || []).some(
          (item) => item._id === id
        );
        setIsWishlisted(isInWishlist);
      }
    } catch (err) {
      if (err?.response?.status === 404) {
        setError('Product not found');
      } else {
        setError(
          err?.response?.data?.message ||
            err?.message ||
            'Something went wrong while loading product details.'
        );
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProductAndWishlist();
  }, [fetchProductAndWishlist]);

  const handleToggleWishlist = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const response = await wishlistApi.patch(`/${id}/toggle`);
      setIsWishlisted(response.data.saved);
      window.dispatchEvent(new Event('wishlistUpdated'));
      showToast(
        response.data.saved
          ? `Saved "${product?.name}" to your wishlist`
          : `Removed "${product?.name}" from wishlist`,
        response.data.saved ? 'success' : 'info'
      );
    } catch {
      showToast('Please sign in or try the Demo Account to save items to your wishlist', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddToCart = async () => {
    if (isAdding || (product && product.stock <= 0)) return;
    setIsAddingLocal(true);
    try {
      let res;
      if (selectedQty > 1) {
        res = await applyApprovedItems([{ productId: id, quantity: selectedQty }]);
      } else {
        res = await addToCart(id);
      }

      if (!res.success) {
        if (res.status === 401) {
          showToast('Please sign in or try the Demo Account to add items to your cart', 'error');
          navigate('/login');
        } else {
          showToast(res.message || 'Unable to add to cart', 'error');
        }
      } else {
        showToast(
          selectedQty > 1
            ? `Added ${selectedQty} units of "${product.name}" to your cart`
            : inCart
            ? `Added another unit of "${product.name}" to your cart`
            : `Added "${product.name}" to your cart`,
          'success'
        );
      }
    } catch {
      showToast('Failed to add to cart', 'error');
    } finally {
      setIsAddingLocal(false);
    }
  };

  const openAiWithPrompt = (promptText) => {
    navigate(`/smart-shop?q=${encodeURIComponent(promptText)}`);
  };

  if (loading) {
    return (
      <div className="product-details-container" aria-busy="true">
        <div className="product-details-card">
          <div className="skeleton-box" style={{ minHeight: '380px', borderRadius: '14px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="skeleton-box skeleton-line-sm" />
            <div className="skeleton-box skeleton-line-lg" style={{ height: '38px' }} />
            <div className="skeleton-box skeleton-line-md" />
            <div className="skeleton-box" style={{ height: '120px', borderRadius: '10px' }} />
            <div className="skeleton-box skeleton-btn" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state">
        <h3>{error}</h3>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '1rem' }}>
          <button
            type="button"
            className="btn btn-primary btn-inline"
            onClick={fetchProductAndWishlist}
          >
            <RotateCcw size={15} />
            <span>Retry</span>
          </button>
          <Link to="/products" className="btn btn-outline btn-inline">
            Back to Catalogue
          </Link>
        </div>
      </div>
    );
  }

  if (!product) return <div className="empty-state">No product found.</div>;

  const stock = Number(product.stock || 0);
  const maxOrderable = Math.max(1, Math.min(10, stock || 1));
  const hasGenuineRating =
    product.genuineRating !== null &&
    product.genuineRating !== undefined &&
    Number(product.genuineReviewCount || 0) > 0;

  const knownTradeOffs = Array.isArray(product.knownTradeOffs) && product.knownTradeOffs.length > 0
    ? product.knownTradeOffs
    : [
        'Check workspace dimensions and compatibility with your existing setup before ordering.',
        `Priced at ₹${product.price.toLocaleString('en-IN')} in the ${product.category} department.`
      ];

  return (
    <div className="product-details-container">
      <div className="pdp-breadcrumb-bar">
        <Link to="/products" className="back-link" style={{ marginBottom: 0 }}>
          <ArrowLeft size={16} />
          <span>Back to Catalogue</span>
        </Link>
        <div className="pdp-breadcrumb-trail">
          <Link to={`/products?category=${encodeURIComponent(product.category)}`}>
            {product.category}
          </Link>
          <span>/</span>
          <span>{product.name}</span>
        </div>
      </div>

      {/* Contiguous PDP Layout: 1. Images -> 2. Price/Stock/Purchase -> 3. Key Specs -> 4. Known Trade-Offs */}
      <div className="product-details-card">
        {/* 1. Product Imagery */}
        <div className="details-image-section">
          <img
            src={product.image}
            alt={product.name}
            referrerPolicy="no-referrer"
            className="details-image"
            onError={handleImageError}
          />
        </div>

        <div className="details-info-section">
          <span className="details-category">
            {product.brand ? `${product.brand} · ` : ''}
            {product.category}
            {product.sku ? ` · SKU: ${product.sku}` : ''}
          </span>

          <h1 className="details-name">{product.name}</h1>

          {/* Genuine Customer Rating Row */}
          <div className="pdp-rating-strip">
            {hasGenuineRating ? (
              <>
                <span className="product-star-badge">
                  <Star size={15} fill="#D97706" color="#D97706" />
                  <strong>{product.genuineRating} / 5</strong>
                </span>
                <span className="product-review-count">
                  ({product.genuineReviewCount} genuine customer{' '}
                  {product.genuineReviewCount === 1 ? 'review' : 'reviews'})
                </span>
              </>
            ) : (
              <span className="product-no-rating">
                <Star size={14} color="#94A3B8" />
                <span>No real customer ratings yet (sample reviews excluded)</span>
              </span>
            )}
          </div>

          {/* 2. Price & Stock Status */}
          <div className="pdp-price-stock-bar">
            <div className="details-price" style={{ marginBottom: 0 }}>
              ₹{product.price.toLocaleString('en-IN')}
            </div>
            <div className="details-stock-status" style={{ marginBottom: 0 }}>
              {stock <= 0 ? (
                <span className="out-of-stock">Out of stock</span>
              ) : stock <= 5 ? (
                <span className="low-stock-tag">Only {stock} left in stock</span>
              ) : (
                <span className="in-stock">In stock ({stock} available)</span>
              )}
            </div>
          </div>

          <p className="details-description">{product.description}</p>

          {/* Purchase Controls */}
          <div className="pdp-purchase-module">
            {stock > 0 && (
              <div className="pdp-qty-row">
                <span className="pdp-qty-label">Quantity:</span>
                <div className="quantity-control-group">
                  <button
                    type="button"
                    className="qty-btn"
                    onClick={() => setSelectedQty((q) => Math.max(1, q - 1))}
                    disabled={selectedQty <= 1 || isAdding}
                    aria-label="Decrease quantity"
                  >
                    <Minus size={15} />
                  </button>
                  <span className="qty-value">{selectedQty}</span>
                  <button
                    type="button"
                    className="qty-btn"
                    onClick={() => setSelectedQty((q) => Math.min(maxOrderable, q + 1))}
                    disabled={selectedQty >= maxOrderable || isAdding}
                    aria-label="Increase quantity"
                  >
                    <Plus size={15} />
                  </button>
                </div>
                {currentCartQty > 0 && (
                  <span className="pdp-in-cart-note">
                    ({currentCartQty} already in your cart)
                  </span>
                )}
              </div>
            )}

            <div className="pdp-cta-row">
              <button
                type="button"
                className="add-to-cart-btn"
                onClick={handleAddToCart}
                disabled={stock <= 0 || isAdding}
                style={{ flex: 1.4, minWidth: '180px' }}
              >
                <ShoppingBag
                  size={18}
                  style={{ display: 'inline', marginRight: '0.45rem', verticalAlign: 'text-bottom' }}
                />
                {stock <= 0
                  ? 'Out of Stock'
                  : isAdding
                  ? 'Adding...'
                  : selectedQty > 1
                  ? `Add ${selectedQty} to Cart · ₹${(product.price * selectedQty).toLocaleString('en-IN')}`
                  : inCart
                  ? 'Add Another to Cart'
                  : 'Add to Cart'}
              </button>

              <button
                type="button"
                onClick={handleToggleWishlist}
                disabled={isSaving}
                className="btn btn-outline"
                style={{
                  flex: 1,
                  minWidth: '160px',
                  borderColor: isWishlisted ? 'var(--error-color)' : 'var(--border-subtle)',
                  color: isWishlisted ? 'var(--error-color)' : 'var(--text-main)'
                }}
              >
                <Heart size={16} fill={isWishlisted ? 'currentColor' : 'none'} />
                <span>
                  {isSaving
                    ? 'Saving...'
                    : isWishlisted
                    ? 'Saved in Wishlist'
                    : 'Save to Wishlist'}
                </span>
              </button>
            </div>
          </div>

          {/* 3. Key Specifications */}
          {product.attributes && Object.keys(product.attributes).length > 0 && (
            <div className="pdp-specs-box">
              <span className="pdp-specs-title">Key Specifications</span>
              <div className="pdp-specs-grid">
                {Object.entries(product.attributes).map(([key, val]) => (
                  <div key={key} className="pdp-spec-cell">
                    <span className="pdp-spec-key">{key}</span>
                    <span className="pdp-spec-val">{String(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Known Trade-Offs (Shown Honestly) */}
          <div className="pdp-tradeoffs-box">
            <div className="pdp-tradeoffs-header">
              <AlertTriangle size={16} />
              <span>Known trade-offs (honest buying notes)</span>
            </div>
            <ul className="pdp-tradeoffs-list">
              {knownTradeOffs.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>

          {/* Contextual Shop by Goal Entry Points */}
          <div className="pdp-ai-context-box">
            <div className="pdp-ai-context-header">
              <Sparkles size={15} />
              <span>{UI_STRINGS.shopByGoal} — Build with {product.name}</span>
            </div>
            <div className="pdp-ai-actions-grid">
              <button
                type="button"
                className="pdp-ai-action-chip"
                onClick={() =>
                  openAiWithPrompt(
                    `Help me evaluate ${product.name} (₹${product.price}) in ${product.category} and suggest if it fits my needs.`
                  )
                }
              >
                <Sparkles size={14} />
                <span>Check if this fits my goal</span>
              </button>

              <button
                type="button"
                className="pdp-ai-action-chip"
                onClick={() =>
                  openAiWithPrompt(
                    `Find complementary products that pair well with ${product.name} (${product.category}).`
                  )
                }
              >
                <Compass size={14} />
                <span>Find matching accessories</span>
              </button>

              <button
                type="button"
                className="pdp-ai-action-chip"
                onClick={() =>
                  openAiWithPrompt(
                    `Build a complete ${product.category.toLowerCase()} & workspace setup around ${product.name}.`
                  )
                }
              >
                <Layers size={14} />
                <span>Build a bundle around this</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Reviews Section: Verified Purchase first -> Customer Reviews second -> Sample Reviews last */}
      <ProductReviewsSection productId={id} />
    </div>
  );
};

export default ProductDetails;
