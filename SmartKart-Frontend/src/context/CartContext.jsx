import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { cartApi, aiApi } from '../services/api';

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState([]);
  const [activeDiscountOffer, setActiveDiscountOffer] = useState(null);
  const [discountInvalidatedNotice, setDiscountInvalidatedNotice] = useState('');
  const [lastShoppingObjective, setLastShoppingObjective] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState({});

  const syncDiscountState = useCallback((nextOffer, wasIntentionalRemoval = false) => {
    setActiveDiscountOffer((prevOffer) => {
      if (prevOffer && !nextOffer && !wasIntentionalRemoval) {
        setDiscountInvalidatedNotice(
          `Your previous ${prevOffer.discountPercent}% discount (${prevOffer.offerId || 'bundle code'}) expired because your cart items changed. You can ask for a fresh discount below.`
        );
      } else if (nextOffer) {
        setDiscountInvalidatedNotice('');
      }
      return nextOffer || null;
    });
  }, []);

  const fetchCart = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await cartApi.get('/');
      setCart(response.data.cart || []);
      setActiveDiscountOffer(response.data.activeDiscountOffer || null);
    } catch (err) {
      if (err.response?.status === 401) {
        setCart([]);
        setActiveDiscountOffer(null);
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
    setActionLoading((prev) => ({ ...prev, [productId]: 'adding' }));
    try {
      const response = await cartApi.post(`/${productId}`);
      setCart(response.data.cart || []);
      syncDiscountState(response.data.activeDiscountOffer || null);
      return { success: true, message: response.data.message || 'Item added to cart' };
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || err.message || 'Failed to add item to cart';
      return { success: false, status, message };
    } finally {
      setActionLoading((prev) => {
        const updated = { ...prev };
        delete updated[productId];
        return updated;
      });
    }
  }, [syncDiscountState]);

  const applyApprovedItems = useCallback(async (items, objective = '') => {
    try {
      const response = await aiApi.post('/smart-shop/apply', { items });
      setCart(response.data.cart || []);
      syncDiscountState(response.data.activeDiscountOffer || null);
      if (objective) {
        setLastShoppingObjective(objective);
      }
      return {
        success: true,
        message: response.data.message || 'Approved items added to your cart',
        cart: response.data.cart || []
      };
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || err.message || 'Failed to add selected items to cart';
      return { success: false, status, message };
    }
  }, [syncDiscountState]);

  const updateQuantity = useCallback(async (productId, quantity) => {
    setActionLoading((prev) => ({ ...prev, [productId]: 'updating' }));
    try {
      const response = await cartApi.patch(`/${productId}`, { quantity });
      setCart(response.data.cart || []);
      syncDiscountState(response.data.activeDiscountOffer || null);
      return { success: true, message: response.data.message || 'Quantity updated' };
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to update quantity';
      return { success: false, message };
    } finally {
      setActionLoading((prev) => {
        const updated = { ...prev };
        delete updated[productId];
        return updated;
      });
    }
  }, [syncDiscountState]);

  const removeFromCart = useCallback(async (productId) => {
    setActionLoading((prev) => ({ ...prev, [productId]: 'removing' }));
    try {
      const response = await cartApi.delete(`/${productId}`);
      setCart(response.data.cart || []);
      syncDiscountState(response.data.activeDiscountOffer || null);
      return { success: true, message: response.data.message || 'Item removed from cart' };
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to remove item';
      return { success: false, message };
    } finally {
      setActionLoading((prev) => {
        const updated = { ...prev };
        delete updated[productId];
        return updated;
      });
    }
  }, [syncDiscountState]);

  const replaceCartProduct = useCallback(async (oldProductId, newProductId) => {
    setActionLoading((prev) => ({ ...prev, [oldProductId]: 'replacing' }));
    try {
      const response = await aiApi.post('/smart-cart/replace', { oldProductId, newProductId });
      setCart(response.data.cart || []);
      syncDiscountState(response.data.activeDiscountOffer || null);
      return {
        success: true,
        message: response.data.message || 'Product replaced in cart',
        cart: response.data.cart || []
      };
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to replace product';
      return { success: false, message };
    } finally {
      setActionLoading((prev) => {
        const updated = { ...prev };
        delete updated[oldProductId];
        return updated;
      });
    }
  }, [syncDiscountState]);

  const negotiateDiscount = useCallback(async (message) => {
    try {
      const response = await aiApi.post('/smart-cart/negotiate', { message });
      if (response.data.offer) {
        setActiveDiscountOffer(response.data.offer);
        setDiscountInvalidatedNotice('');
      }
      return {
        success: true,
        ...response.data
      };
    } catch (err) {
      const messageText = err.response?.data?.message || err.message || 'Unable to evaluate discount request';
      return { success: false, message: messageText };
    }
  }, []);

  const removeDiscountOffer = useCallback(async () => {
    try {
      await cartApi.delete('/discount/offer');
    } catch {
      // Fallback local clear if endpoint fails
    }
    setActiveDiscountOffer(null);
    setDiscountInvalidatedNotice('');
    return { success: true };
  }, []);

  const dismissDiscountInvalidatedNotice = useCallback(() => {
    setDiscountInvalidatedNotice('');
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setActiveDiscountOffer(null);
    setDiscountInvalidatedNotice('');
  }, []);

  const totalCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
  }, [cart]);

  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const price = item.product?.price || 0;
      const qty = item.quantity || 0;
      return sum + price * qty;
    }, 0);
  }, [cart]);

  const discountPercent = useMemo(() => {
    if (!activeDiscountOffer || cart.length === 0) return 0;
    return Math.min(15, Math.max(0, Number(activeDiscountOffer.discountPercent || 0)));
  }, [activeDiscountOffer, cart.length]);

  const discountAmount = useMemo(() => {
    if (!activeDiscountOffer || cart.length === 0 || discountPercent <= 0) return 0;
    const eligibleSub = cart.reduce((sum, item) => {
      if (item.product?.discountEligible === false) return sum;
      return sum + (item.product?.price || 0) * (item.quantity || 0);
    }, 0);
    return Math.round((eligibleSub * discountPercent) / 100);
  }, [activeDiscountOffer, cart, discountPercent]);

  const finalTotal = useMemo(() => {
    return Math.max(0, subtotal - discountAmount);
  }, [subtotal, discountAmount]);

  const itemCount = cart.length;
  const hasPersistedCartItems = cart.length > 0;

  const isInCart = useCallback((productId) => {
    return cart.some((item) => {
      const id = item.product?._id || item.product;
      return id === productId;
    });
  }, [cart]);

  const getItemQuantity = useCallback((productId) => {
    const item = cart.find((i) => {
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
    discountPercent,
    discountAmount,
    finalTotal,
    activeDiscountOffer,
    discountInvalidatedNotice,
    dismissDiscountInvalidatedNotice,
    removeDiscountOffer,
    lastShoppingObjective,
    setLastShoppingObjective,
    itemCount,
    hasPersistedCartItems,
    fetchCart,
    addToCart,
    applyApprovedItems,
    updateQuantity,
    removeFromCart,
    replaceCartProduct,
    negotiateDiscount,
    clearCart,
    isInCart,
    getItemQuantity
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export default CartContext;
