import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, Truck, Lock, AlertCircle, ArrowLeft } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { orderApi } from '../services/api';

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      return resolve(true);
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const Checkout = () => {
  const navigate = useNavigate();
  const { cart, subtotal, totalCount, clearCart } = useCart();

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    addressLine1: '',
    city: '',
    state: '',
    pincode: ''
  });

  const [errors, setErrors] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [serverError, setServerError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full Name is required';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\+?[0-9\s-]{10,15}$/.test(formData.phone.trim())) {
      newErrors.phone = 'Please enter a valid 10-digit phone number';
    }

    if (!formData.addressLine1.trim()) {
      newErrors.addressLine1 = 'Address line is required';
    }

    if (!formData.city.trim()) {
      newErrors.city = 'City is required';
    }

    if (!formData.state.trim()) {
      newErrors.state = 'State is required';
    }

    if (!formData.pincode.trim()) {
      newErrors.pincode = 'Pincode is required';
    } else if (!/^[0-9]{6}$/.test(formData.pincode.trim())) {
      newErrors.pincode = 'Pincode must contain 6 digits';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setServerError('');

    if (!validateForm()) {
      return;
    }

    if (!cart || cart.length === 0) {
      setServerError('Your cart is empty. Please add items before checking out.');
      return;
    }

    setIsProcessing(true);

    try {
      const response = await orderApi.post('/create-payment-order', {
        shippingAddress: {
          fullName: formData.fullName.trim(),
          phone: formData.phone.trim(),
          addressLine1: formData.addressLine1.trim(),
          city: formData.city.trim(),
          state: formData.state.trim(),
          pincode: formData.pincode.trim()
        }
      });

      const { shopKartOrderId, razorpayOrderId, amount, currency, key } = response.data;

      const scriptLoaded = await loadRazorpayScript();

      if (scriptLoaded && window.Razorpay) {
        const options = {
          key: key,
          amount: amount,
          currency: currency,
          name: 'ShopKart',
          description: `Order #${shopKartOrderId.slice(-6)}`,
          order_id: razorpayOrderId,
          prefill: {
            name: formData.fullName,
            contact: formData.phone
          },
          theme: {
            color: '#0F172A'
          },
          handler: async function (paymentResponse) {
            try {
              const verifyRes = await orderApi.post('/verify-payment', {
                shopKartOrderId,
                razorpay_order_id: paymentResponse.razorpay_order_id || razorpayOrderId,
                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                razorpay_signature: paymentResponse.razorpay_signature
              });

              if (verifyRes.data.success) {
                clearCart();
                navigate(`/order-success/${shopKartOrderId}`);
              } else {
                setServerError(verifyRes.data.message || 'Payment verification failed.');
              }
            } catch (err) {
              setServerError(err.response?.data?.message || 'Payment verification failed. Your cart was preserved.');
            } finally {
              setIsProcessing(false);
            }
          },
          modal: {
            ondismiss: function () {
              setIsProcessing(false);
            }
          }
        };

        const paymentObject = new window.Razorpay(options);

        paymentObject.on('payment.failed', function (failRes) {
          console.error('Payment failed:', failRes.error);
          setServerError(`Payment failed: ${failRes.error?.description || 'Transaction declined'}. Your cart has not been cleared.`);
          setIsProcessing(false);
        });

        paymentObject.open();
      } else {
        const paymentId = 'pay_sim_' + Math.random().toString(36).substring(2, 10);
        const verifyRes = await orderApi.post('/verify-payment', {
          shopKartOrderId,
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: 'sim_sig_' + razorpayOrderId
        });

        if (verifyRes.data.success) {
          clearCart();
          navigate(`/order-success/${shopKartOrderId}`);
        } else {
          setServerError('Payment verification failed.');
        }
        setIsProcessing(false);
      }
    } catch (err) {
      console.error('Order creation error:', err);
      setServerError(err.response?.data?.message || err.message || 'Unable to place order. Please try again.');
      setIsProcessing(false);
    }
  };

  if (!cart || cart.length === 0) {
    return (
      <div className="cart-page-container">
        <div className="cart-empty-state">
          <div className="empty-cart-icon">🛒</div>
          <h2>Your cart is empty</h2>
          <p className="empty-cart-subtitle">
            You cannot checkout with an empty cart. Please add products first.
          </p>
          <Link to="/products" className="btn btn-primary browse-btn">
            Browse Products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-page-container">
      <div className="checkout-header">
        <Link to="/cart" className="back-link">
          <ArrowLeft size={16} />
          <span>Back to Cart</span>
        </Link>
        <h2>Checkout</h2>
        <p className="checkout-subtitle">Please enter your shipping address to complete your order</p>
      </div>

      {serverError && (
        <div className="checkout-error-banner">
          <AlertCircle size={20} />
          <span>{serverError}</span>
        </div>
      )}

      <div className="checkout-grid">
        <div className="checkout-form-section">
          <div className="checkout-card">
            <h3 className="section-title">Shipping Details</h3>

            <form onSubmit={handlePlaceOrder} id="checkout-form" noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="fullName">Full Name *</label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  className={`form-input ${errors.fullName ? 'input-error' : ''}`}
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="e.g. Aarav Sharma"
                  disabled={isProcessing}
                />
                {errors.fullName && <span className="field-error">{errors.fullName}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="phone">Phone Number *</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  className={`form-input ${errors.phone ? 'input-error' : ''}`}
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="e.g. 9876543210"
                  disabled={isProcessing}
                />
                {errors.phone && <span className="field-error">{errors.phone}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="addressLine1">Address Line 1 *</label>
                <input
                  type="text"
                  id="addressLine1"
                  name="addressLine1"
                  className={`form-input ${errors.addressLine1 ? 'input-error' : ''}`}
                  value={formData.addressLine1}
                  onChange={handleChange}
                  placeholder="e.g. 22 MG Road, Flat 402"
                  disabled={isProcessing}
                />
                {errors.addressLine1 && <span className="field-error">{errors.addressLine1}</span>}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="city">City *</label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    className={`form-input ${errors.city ? 'input-error' : ''}`}
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="e.g. Bengaluru"
                    disabled={isProcessing}
                  />
                  {errors.city && <span className="field-error">{errors.city}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="state">State *</label>
                  <input
                    type="text"
                    id="state"
                    name="state"
                    className={`form-input ${errors.state ? 'input-error' : ''}`}
                    value={formData.state}
                    onChange={handleChange}
                    placeholder="e.g. Karnataka"
                    disabled={isProcessing}
                  />
                  {errors.state && <span className="field-error">{errors.state}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="pincode">Pincode *</label>
                  <input
                    type="text"
                    id="pincode"
                    name="pincode"
                    className={`form-input ${errors.pincode ? 'input-error' : ''}`}
                    value={formData.pincode}
                    onChange={handleChange}
                    placeholder="e.g. 560001"
                    maxLength={6}
                    disabled={isProcessing}
                  />
                  {errors.pincode && <span className="field-error">{errors.pincode}</span>}
                </div>
              </div>
            </form>
          </div>
        </div>

        <aside className="checkout-summary-section">
          <div className="checkout-card summary-sticky">
            <h3 className="section-title">Order Summary</h3>

            <div className="checkout-items-preview">
              {cart.map((item) => (
                <div key={item.product?._id || item._id} className="checkout-item-row">
                  <div className="checkout-item-thumb">
                    <img src={item.product?.image} alt={item.product?.name} />
                  </div>
                  <div className="checkout-item-info">
                    <span className="checkout-item-name">{item.product?.name}</span>
                    <span className="checkout-item-qty">Qty: {item.quantity}</span>
                  </div>
                  <span className="checkout-item-price">
                    ₹{((item.product?.price || 0) * (item.quantity || 1)).toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>

            <div className="summary-divider"></div>

            <div className="summary-row">
              <span className="summary-label">Items ({totalCount}):</span>
              <span className="summary-value">₹{subtotal.toLocaleString('en-IN')}</span>
            </div>

            <div className="summary-row">
              <span className="summary-label">Shipping:</span>
              <span className="summary-value shipping-free">FREE</span>
            </div>

            <div className="summary-divider"></div>

            <div className="summary-row summary-total-row">
              <span className="summary-total-label">Total to Pay:</span>
              <span className="summary-total-value">₹{subtotal.toLocaleString('en-IN')}</span>
            </div>

            <button
              type="submit"
              form="checkout-form"
              className="btn btn-primary place-order-btn"
              disabled={isProcessing}
            >
              <Lock size={18} />
              <span>{isProcessing ? 'Processing Payment...' : 'Pay with Razorpay'}</span>
            </button>

            <div className="checkout-trust-box">
              <div className="trust-badge-item">
                <ShieldCheck size={16} />
                <span>Razorpay Test Mode — 100% Safe Simulation</span>
              </div>
              <div className="trust-badge-item">
                <Truck size={16} />
                <span>Free delivery with full tracking</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Checkout;
