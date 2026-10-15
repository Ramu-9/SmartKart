import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Plus, Minus } from 'lucide-react';
import { useCart } from '../context/CartContext';

const CartItem = ({ item }) => {
  const { updateQuantity, removeFromCart, actionLoading } = useCart();
  const [errorMessage, setErrorMessage] = useState('');

  const product = item.product || {};
  const quantity = item.quantity || 1;
  const productId = product._id;
  const isUpdating = actionLoading[productId] === 'updating';
  const isRemoving = actionLoading[productId] === 'removing';
  const isBusy = isUpdating || isRemoving;

  const handleDecrease = async () => {
    if (quantity <= 1 || isBusy) return;
    setErrorMessage('');
    const result = await updateQuantity(productId, quantity - 1);
    if (!result.success) {
      setErrorMessage(result.message);
    }
  };

  const handleIncrease = async () => {
    if (quantity >= product.stock || isBusy) return;
    setErrorMessage('');
    const result = await updateQuantity(productId, quantity + 1);
    if (!result.success) {
      setErrorMessage(result.message);
    }
  };

  const handleRemove = async () => {
    if (isBusy) return;
    setErrorMessage('');
    const result = await removeFromCart(productId);
    if (!result.success) {
      setErrorMessage(result.message);
    }
  };

  const itemTotal = (product.price || 0) * quantity;
  const isAtMaxStock = quantity >= (product.stock || 0);

  return (
    <div className={`cart-item-card ${isBusy ? 'item-busy' : ''}`}>
      <div className="cart-item-image-wrapper">
        <img src={product.image} alt={product.name} className="cart-item-image" />
      </div>

      <div className="cart-item-details">
        <div className="cart-item-header">
          <Link to={`/products/${productId}`} className="cart-item-title">
            {product.name}
          </Link>
          <span className="cart-item-category">{product.category}</span>
        </div>

        <div className="cart-item-price-unit">
          ₹{(product.price || 0).toLocaleString('en-IN')} each
        </div>

        <div className="cart-item-stock-info">
          {product.stock > 0 ? (
            <span className="stock-available">{product.stock} units available</span>
          ) : (
            <span className="stock-out">Out of stock</span>
          )}
          {isAtMaxStock && (
            <span className="stock-limit-badge">Max stock reached</span>
          )}
        </div>

        {errorMessage && (
          <div className="cart-item-error">{errorMessage}</div>
        )}
      </div>

      <div className="cart-item-actions">
        <div className="quantity-control-group">
          <button
            type="button"
            className="qty-btn"
            onClick={handleDecrease}
            disabled={quantity <= 1 || isBusy}
            title={quantity <= 1 ? "Minimum quantity is 1. Use remove to delete item." : "Decrease quantity"}
            aria-label="Decrease quantity"
          >
            <Minus size={16} />
          </button>
          <span className="qty-value">{quantity}</span>
          <button
            type="button"
            className="qty-btn"
            onClick={handleIncrease}
            disabled={isAtMaxStock || isBusy}
            title={isAtMaxStock ? "Maximum available stock reached" : "Increase quantity"}
            aria-label="Increase quantity"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="cart-item-subtotal">
          ₹{itemTotal.toLocaleString('en-IN')}
        </div>

        <button
          type="button"
          className="cart-remove-btn"
          onClick={handleRemove}
          disabled={isBusy}
          aria-label="Remove item from cart"
        >
          <Trash2 size={16} />
          <span>{isRemoving ? 'Removing...' : 'Remove'}</span>
        </button>
      </div>
    </div>
  );
};

export default CartItem;
