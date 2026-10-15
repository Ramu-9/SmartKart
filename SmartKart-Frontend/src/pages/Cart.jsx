import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Truck } from 'lucide-react';
import { useCart } from '../context/CartContext';
import CartItem from '../components/CartItem';

const Cart = () => {
  const navigate = useNavigate();
  const { cart, loading, error, subtotal, totalCount, fetchCart } = useCart();

  if (loading) {
    return (
      <div className="cart-page-container">
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
          <h2>Unable to load your cart.</h2>
          <p style={{ margin: '1rem 0' }}>{error}</p>
          <button className="btn btn-primary" onClick={fetchCart}>
            Try Again
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
          <h2>Your cart is empty</h2>
          <p className="empty-cart-subtitle">
            Looks like you haven't added anything yet.
          </p>
          <Link to="/products" className="btn btn-primary browse-btn">
            Browse Products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page-container">
      <div className="cart-page-header">
        <div>
          <h2>My Cart</h2>
          <p className="cart-header-subtitle">
            {totalCount} {totalCount === 1 ? 'item' : 'items'} in your cart
          </p>
        </div>
        <Link to="/products" className="continue-shopping-link">
          &larr; Continue Shopping
        </Link>
      </div>

      <div className="cart-layout">
        <div className="cart-items-section">
          {cart.map((item) => (
            <CartItem key={item.product?._id || item._id} item={item} />
          ))}
        </div>

        <aside className="order-summary-sidebar">
          <div className="order-summary-card">
            <h3 className="summary-title">Order Summary</h3>

            <div className="summary-row">
              <span className="summary-label">Items:</span>
              <span className="summary-value">{totalCount}</span>
            </div>

            <div className="summary-row">
              <span className="summary-label">Subtotal:</span>
              <span className="summary-value">₹{subtotal.toLocaleString('en-IN')}</span>
            </div>

            <div className="summary-row">
              <span className="summary-label">Shipping:</span>
              <span className="summary-value shipping-free">FREE</span>
            </div>

            <div className="summary-divider"></div>

            <div className="summary-row summary-total-row">
              <span className="summary-total-label">Total:</span>
              <span className="summary-total-value">₹{subtotal.toLocaleString('en-IN')}</span>
            </div>

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
                <ShieldCheck size={18} />
                <span>Secure SSL Checkout</span>
              </div>
              <div className="trust-badge-item">
                <Truck size={18} />
                <span>Free delivery on all orders</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Cart;
