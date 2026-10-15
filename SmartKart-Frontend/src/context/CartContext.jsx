import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { cartApi } from '../services/api';

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState({});

  const fetchCart = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await cartApi.get('/');
      setCart(response.data.cart || []);
    } catch (err) {
      if (err.response?.status === 401) {
        setCart([]);
      } else {
        setError(err.response?.data?.message || err.message || 'Unable to load your cart.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const addToCart = useCallback(async (productId) => {
    setActionLoading(prev => ({ ...prev, [productId]: 'adding' }));
    try {
      const response = await cartApi.post(`/${productId}`);
      setCart(response.data.cart || []);
      return { success: true, message: response.data.message || 'Item added to cart' };
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to add item to cart';
      return { success: false, message };
    } finally {
      setActionLoading(prev => {
        const updated = { ...prev };
        delete updated[productId];
        return updated;
      });
    }
  }, []);

  const updateQuantity = useCallback(async (productId, quantity) => {
    setActionLoading(prev => ({ ...prev, [productId]: 'updating' }));
    try {
      const response = await cartApi.patch(`/${productId}`, { quantity });
      setCart(response.data.cart || []);
      return { success: true, message: response.data.message || 'Quantity updated' };
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to update quantity';
      return { success: false, message };
    } finally {
      setActionLoading(prev => {
        const updated = { ...prev };
        delete updated[productId];
        return updated;
      });
    }
  }, []);

  const removeFromCart = useCallback(async (productId) => {
    setActionLoading(prev => ({ ...prev, [productId]: 'removing' }));
    try {
      const response = await cartApi.delete(`/${productId}`);
      setCart(response.data.cart || []);
      return { success: true, message: response.data.message || 'Item removed from cart' };
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to remove item';
      return { success: false, message };
    } finally {
      setActionLoading(prev => {
        const updated = { ...prev };
        delete updated[productId];
        return updated;
      });
    }
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const totalCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
  }, [cart]);

  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const price = item.product?.price || 0;
      const qty = item.quantity || 0;
      return sum + (price * qty);
    }, 0);
  }, [cart]);

  const itemCount = cart.length;

  const isInCart = useCallback((productId) => {
    return cart.some(item => {
      const id = item.product?._id || item.product;
      return id === productId;
    });
  }, [cart]);

  const getItemQuantity = useCallback((productId) => {
    const item = cart.find(i => {
      const id = i.product?._id || i.product;
      return id === productId;
    });
    return item ? item.quantity : 0;
  }, [cart]);

  const value = {
    cart,
    loading,
    error,
    actionLoading,
    totalCount,
    subtotal,
    itemCount,
    fetchCart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    isInCart,
    getItemQuantity
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export default CartContext;
