import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { wishlistApi } from '../services/api';
import { useCart } from '../context/CartContext';

const ProductCard = ({ product, isWishlisted: initialWishlisted, onWishlistToggle }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(initialWishlisted);
  const [errorMsg, setErrorMsg] = useState('');
  const [cartFeedback, setCartFeedback] = useState('');
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
    setErrorMsg('');
    
    try {
      const response = await wishlistApi.patch(`/${product._id}/toggle`);
      const { saved } = response.data;
      
      setIsWishlisted(saved);
      if (onWishlistToggle) {
        onWishlistToggle(product._id, saved);
      }
      
      window.dispatchEvent(new Event('wishlistUpdated'));
    } catch (error) {
      console.error('Failed to toggle wishlist:', error);
      setErrorMsg('Unable to save product. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddToCart = async () => {
    if (isAdding || product.stock <= 0) return;
    setIsAddingLocal(true);
    setCartFeedback('');
    try {
      const result = await addToCart(product._id);
      if (!result.success) {
        setCartFeedback(result.message);
      } else {
        setCartFeedback(inCart ? 'Added another to cart!' : 'Added to cart!');
        setTimeout(() => setCartFeedback(''), 2500);
      }
    } catch (_err) {
      setCartFeedback('Failed to add to cart');
    } finally {
      setIsAddingLocal(false);
    }
  };

  return (
    <div className="product-card">
      <div className="product-image-wrapper">
        <img src={product.image} alt={product.name} className="product-image" />
        <button 
          className={`wishlist-icon-btn ${isWishlisted ? 'active' : ''}`}
          onClick={handleToggleWishlist}
          disabled={isSaving}
          title={isWishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isSaving ? 'not-allowed' : 'pointer',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
            fontSize: '1.2rem',
            color: isWishlisted ? 'var(--error-color, #ef4444)' : '#ccc',
            transition: 'all 0.2s ease',
            zIndex: 10
          }}
        >
          {isSaving ? '⏳' : isWishlisted ? '♥' : '♡'}
        </button>
      </div>
      <div className="product-info">
        <h3 className="product-name">{product.name}</h3>
        <p className="product-category">{product.category}</p>
        <p className="product-price">₹{product.price.toLocaleString('en-IN')}</p>
        <p className="product-stock">
          {product.stock > 0 ? `${product.stock} units left` : 'Out of stock'}
        </p>
        
        {errorMsg && (
          <p style={{ color: 'var(--error-color, #ef4444)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
            {errorMsg}
          </p>
        )}
        {cartFeedback && (
          <p style={{
            fontSize: '0.8rem',
            color: cartFeedback.includes('Added') ? '#15803d' : '#b91c1c',
            marginTop: '0.25rem',
            fontWeight: '500'
          }}>
            {cartFeedback}
          </p>
        )}
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
          <button
            type="button"
            className="btn btn-primary add-to-cart-btn"
            onClick={handleAddToCart}
            disabled={isAdding || product.stock <= 0}
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '0.5rem'
            }}
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
            type="button"
            onClick={handleToggleWishlist}
            disabled={isSaving}
            className="btn btn-outline" 
            style={{ 
              width: '100%', 
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
          
          <Link to={`/products/${product._id}`} className="view-details-btn" style={{ textAlign: 'center' }}>
            View Details
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
