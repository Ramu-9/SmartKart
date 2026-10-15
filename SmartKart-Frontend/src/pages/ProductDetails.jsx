import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { productApi, wishlistApi } from '../services/api';
import { useCart } from '../context/CartContext';

const ProductDetails = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [cartFeedback, setCartFeedback] = useState('');
  const [isAddingLocal, setIsAddingLocal] = useState(false);

  const { addToCart, isInCart, actionLoading } = useCart();
  const inCart = isInCart(id);
  const isAdding = isAddingLocal || actionLoading[id] === 'adding';

  useEffect(() => {
    fetchProductAndWishlist();
  }, [id]);

  const fetchProductAndWishlist = async () => {
    setLoading(true);
    setError(null);
    try {
      const [productRes, wishlistRes] = await Promise.all([
        productApi.get(`/${id}`),
        wishlistApi.get('/')
      ]);
      setProduct(productRes.data);
      
      const isInWishlist = (wishlistRes.data.wishlist || []).some(item => item._id === id);
      setIsWishlisted(isInWishlist);
    } catch (err) {
      if (err.response?.status === 404) {
        setError('Product not found');
      } else {
        setError(err.response?.data?.message || err.message || 'Something went wrong while loading product details.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleWishlist = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const response = await wishlistApi.patch(`/${id}/toggle`);
      setIsWishlisted(response.data.saved);
      window.dispatchEvent(new Event('wishlistUpdated'));
    } catch (_err) {
      alert('Unable to save product. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddToCart = async () => {
    if (isAdding || (product && product.stock <= 0)) return;
    setIsAddingLocal(true);
    setCartFeedback('');
    try {
      const res = await addToCart(id);
      if (!res.success) {
        setCartFeedback(res.message);
      } else {
        setCartFeedback(inCart ? 'Added another unit to cart!' : 'Added to cart!');
        setTimeout(() => setCartFeedback(''), 3000);
      }
    } catch (_err) {
      setCartFeedback('Failed to add to cart');
    } finally {
      setIsAddingLocal(false);
    }
  };

  if (loading) return <div className="loading-state">Loading product details...</div>;
  if (error) return <div className="error-state">{error} <br/><Link to="/products">Back to Products</Link></div>;
  if (!product) return <div className="empty-state">No product found.</div>;

  return (
    <div className="product-details-container">
      <div className="product-details-card">
        <div className="details-image-section">
          <img src={product.image} alt={product.name} className="details-image" />
        </div>
        <div className="details-info-section">
          <Link to="/products" className="back-link">&larr; Back to Catalog</Link>
          <h2 className="details-name">{product.name}</h2>
          <span className="details-category">{product.category}</span>
          <p className="details-description">{product.description}</p>
          <div className="details-price">₹{product.price.toLocaleString('en-IN')}</div>
          
          <div className="details-stock-status">
            {product.stock > 0 ? (
              <span className="in-stock">{product.stock} in stock</span>
            ) : (
              <span className="out-of-stock">Out of stock</span>
            )}
          </div>

          {cartFeedback && (
            <div style={{
              marginTop: '1rem',
              padding: '0.6rem 1rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.9rem',
              fontWeight: '500',
              backgroundColor: cartFeedback.includes('Added') ? '#f0fdf4' : '#fef2f2',
              color: cartFeedback.includes('Added') ? '#15803d' : '#b91c1c',
              border: `1px solid ${cartFeedback.includes('Added') ? '#bbf7d0' : '#fecaca'}`
            }}>
              {cartFeedback}
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            <button 
              className="add-to-cart-btn" 
              onClick={handleAddToCart}
              disabled={product.stock <= 0 || isAdding}
              style={{ flex: 1, minWidth: '160px' }}
            >
              {product.stock <= 0
                ? 'Out of Stock'
                : isAdding
                ? 'Adding...'
                : inCart
                ? 'Add Another'
                : 'Add to Cart'}
            </button>
            <button
              onClick={handleToggleWishlist}
              disabled={isSaving}
              className="btn btn-outline"
              style={{ 
                flex: 1, 
                minWidth: '160px',
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center',
                gap: '0.5rem',
                borderColor: isWishlisted ? 'var(--error-color, #ef4444)' : 'var(--border-color, #e2e8f0)',
                color: isWishlisted ? 'var(--error-color, #ef4444)' : 'inherit'
              }}
            >
              {isSaving ? '⏳ Saving...' : isWishlisted ? '♥ Remove from Wishlist' : '♡ Add to Wishlist'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetails;
