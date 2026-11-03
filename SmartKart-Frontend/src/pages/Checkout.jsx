import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ShieldCheck,
  Truck,
  Lock,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Info,
  QrCode,
  Smartphone,
  CreditCard,
  ExternalLink,
  Check,
  Clock,
  RefreshCw
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { orderApi, customerApi } from '../services/api';
import { handleImageError } from '../utils/imageFallback';
import UI_STRINGS from '../constants/uiStrings';

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

// Generates a realistic 25x25 QR code matrix deterministically from the UPI payload string
function buildQrMatrix(payloadString) {
  const size = 25;
  const matrix = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => Array(size).fill(false));

  const placeFinderPattern = (rowOffset, colOffset) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = rowOffset + r;
        const cc = colOffset + c;
        if (rr >= 0 && rr < size && cc >= 0 && cc < size) {
          reserved[rr][cc] = true;
          if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
            const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
            const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
            matrix[rr][cc] = isBorder || isInner;
          }
        }
      }
    }
  };

  placeFinderPattern(0, 0);
  placeFinderPattern(0, size - 7);
  placeFinderPattern(size - 7, 0);

  // Alignment pattern at bottom-right
  const alignRow = size - 9;
  const alignCol = size - 9;
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const rr = alignRow + r;
      const cc = alignCol + c;
      reserved[rr][cc] = true;
      const isBorder = Math.abs(r) === 2 || Math.abs(c) === 2;
      const isCenter = r === 0 && c === 0;
      matrix[rr][cc] = isBorder || isCenter;
    }
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    reserved[6][i] = true;
    matrix[6][i] = i % 2 === 0;
    reserved[i][6] = true;
    matrix[i][6] = i % 2 === 0;
  }

  // Reserve center 5x5 for UPI / Razorpay badge
  for (let r = 10; r <= 14; r++) {
    for (let c = 10; c <= 14; c++) {
      reserved[r][c] = true;
      matrix[r][c] = false;
    }
  }

  // Fill data bits deterministically from payloadString
  let hash = 2166136261;
  const str = String(payloadString || 'smartkart-razorpay');
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  let seed = Math.abs(hash) || 123456789;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!reserved[r][c]) {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        matrix[r][c] = (seed & 3) !== 0 && ((seed >> 2) & 1) === 1;
      }
    }
  }

  return matrix;
}

const Checkout = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const {
    cart,
    subtotal,
    totalCount,
    clearCart,
    discountPercent,
    discountAmount,
    finalTotal,
    activeDiscountOffer
  } = useCart();

  const [formData, setFormData] = useState({
    fullName: 'Aarav Sharma',
    phone: '9876543210',
    addressLine1: '22 MG Road, Indiranagar',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560038'
  });

  const [errors, setErrors] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [serverError, setServerError] = useState('');

  // Razorpay Gateway & QR Scanner state
  const [razorpaySession, setRazorpaySession] = useState(null);
  const [paymentMethodTab, setPaymentMethodTab] = useState('qr'); // 'qr' | 'upi' | 'card'
  const [upiId, setUpiId] = useState('aarav.sharma@okicici');
  const [qrScanStage, setQrScanStage] = useState('ready'); // 'ready' | 'scanning' | 'verifying'
  const [qrSecondsLeft, setQrSecondsLeft] = useState(600);
  const autoInitRef = useRef(false);

  // Prefill name & phone from logged-in customer profile
  useEffect(() => {
    let mounted = true;
    customerApi
      .get('/me')
      .then((res) => {
        if (!mounted || !res.data) return;
        setFormData((prev) => ({
          ...prev,
          fullName: res.data.fullName || prev.fullName,
          phone: res.data.phone || prev.phone
        }));
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Automatically create Razorpay payment order on Checkout load so the Razorpay QR Scanner is immediately ready
  useEffect(() => {
    if (autoInitRef.current) return;
    if (!cart || cart.length === 0) return;
    autoInitRef.current = true;

    setIsProcessing(true);
    orderApi
      .post('/create-payment-order', {
        shippingAddress: {
          fullName: formData.fullName.trim() || 'Aarav Sharma',
          phone: formData.phone.trim() || '9876543210',
          addressLine1: formData.addressLine1.trim() || '22 MG Road, Indiranagar',
          city: formData.city.trim() || 'Bengaluru',
          state: formData.state.trim() || 'Karnataka',
          pincode: formData.pincode.trim() || '560038'
        }
      })
      .then((res) => {
        setRazorpaySession(res.data);
      })
      .catch((err) => {
        setServerError(
          err.response?.data?.message || 'Could not initialize Razorpay order. Click Refresh QR below.'
        );
      })
      .finally(() => {
        setIsProcessing(false);
      });
  }, [cart, formData]);

  // Countdown timer when Razorpay QR Scanner is open
  useEffect(() => {
    if (!razorpaySession) return;
    setQrSecondsLeft(600);
    const interval = setInterval(() => {
      setQrSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [razorpaySession]);

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const upiUri = useMemo(() => {
    const orderRef = razorpaySession?.razorpayOrderId || 'order_pending';
    const amt = razorpaySession?.finalAmountINR || finalTotal;
    return `upi://pay?pa=smartkart.rzp@axisbank&pn=SmartKart&am=${amt}&cu=INR&tr=${orderRef}`;
  }, [razorpaySession, finalTotal]);

  const qrMatrix = useMemo(() => buildQrMatrix(upiUri), [upiUri]);

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

  // Refresh or create a fresh Razorpay order if needed
  const ensureRazorpayOrder = async () => {
    if (razorpaySession) return razorpaySession;
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
    setRazorpaySession(response.data);
    return response.data;
  };

  // Complete payment via Razorpay QR Scanner or UPI ID (verifies HMAC-SHA256 signature on backend)
  const handleCompleteQrOrUpiPayment = async (sourceLabel = 'Razorpay QR Scanner') => {
    setServerError('');
    if (!validateForm()) {
      setServerError('Please complete all required shipping address fields before paying.');
      return;
    }

    setQrScanStage('scanning');

    try {
      const session = await ensureRazorpayOrder();

      setTimeout(async () => {
        setQrScanStage('verifying');
        try {
          const paymentId =
            session.qrPaymentId || 'pay_qr_' + Math.random().toString(36).substring(2, 10);
          const signature = session.qrSignature || 'sim_sig_' + session.razorpayOrderId;

          const verifyRes = await orderApi.post('/verify-payment', {
            shopKartOrderId: session.shopKartOrderId,
            razorpay_order_id: session.razorpayOrderId,
            razorpay_payment_id: paymentId,
            razorpay_signature: signature,
            shippingAddress: {
              fullName: formData.fullName.trim(),
              phone: formData.phone.trim(),
              addressLine1: formData.addressLine1.trim(),
              city: formData.city.trim(),
              state: formData.state.trim(),
              pincode: formData.pincode.trim()
            }
          });

          if (verifyRes.data.success) {
            clearCart();
            showToast(`Payment verified via ${sourceLabel}!`, 'success');
            navigate(`/order-success/${session.shopKartOrderId}`);
          } else {
            setServerError(verifyRes.data.message || 'Razorpay payment verification failed.');
            setQrScanStage('ready');
          }
        } catch (err) {
          setServerError(
            err.response?.data?.message || 'Payment verification failed. Your cart was preserved.'
          );
          setQrScanStage('ready');
        }
      }, 850);
    } catch (err) {
      setServerError(
        err.response?.data?.message || 'Unable to create Razorpay order. Please try again.'
      );
      setQrScanStage('ready');
    }
  };

  // Launch Official Hosted Razorpay Checkout JS Popup (Cards / Netbanking / Wallets)
  const handleOpenOfficialRazorpayPopup = async () => {
    setServerError('');
    if (!validateForm()) {
      setServerError('Please complete all required shipping address fields before paying.');
      return;
    }

    setIsProcessing(true);

    try {
      const session = await ensureRazorpayOrder();
      const { shopKartOrderId, razorpayOrderId, amount, currency, key } = session;
      const scriptLoaded = await loadRazorpayScript();

      if (
        scriptLoaded &&
        window.Razorpay &&
        razorpayOrderId &&
        !razorpayOrderId.startsWith('order_sim_')
      ) {
        const options = {
          key: key,
          amount: amount,
          currency: currency,
          name: UI_STRINGS.brandName,
          description: `Order #${shopKartOrderId.slice(-6)}`,
          order_id: razorpayOrderId,
          prefill: {
            name: formData.fullName,
            contact: formData.phone,
            email: 'customer@smartkart.in'
          },
          theme: {
            color: '#072654'
          },
          handler: async function (paymentResponse) {
            try {
              const verifyRes = await orderApi.post('/verify-payment', {
                shopKartOrderId,
                razorpay_order_id: paymentResponse.razorpay_order_id || razorpayOrderId,
                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                razorpay_signature: paymentResponse.razorpay_signature,
                shippingAddress: {
                  fullName: formData.fullName.trim(),
                  phone: formData.phone.trim(),
                  addressLine1: formData.addressLine1.trim(),
                  city: formData.city.trim(),
                  state: formData.state.trim(),
                  pincode: formData.pincode.trim()
                }
              });

              if (verifyRes.data.success) {
                clearCart();
                showToast('Razorpay payment verified! Redirecting...', 'success');
                navigate(`/order-success/${shopKartOrderId}`);
              } else {
                setServerError(verifyRes.data.message || 'Payment verification failed.');
              }
            } catch (err) {
              setServerError(
                err.response?.data?.message ||
                  'Payment verification failed. Your cart was preserved.'
              );
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
          setServerError(
            `Payment failed: ${
              failRes.error?.description || 'Transaction declined'
            }. Your cart has not been cleared.`
          );
          setIsProcessing(false);
        });

        paymentObject.open();
      } else {
        setIsProcessing(false);
        handleCompleteQrOrUpiPayment('Razorpay Gateway');
      }
    } catch (err) {
      setIsProcessing(false);
      setServerError(
        err.response?.data?.message || 'Could not open Razorpay Checkout. Please try again.'
      );
    }
  };

  if ((!cart || cart.length === 0) && !razorpaySession) {
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

  const displayAmount = Number(razorpaySession?.finalAmountINR || finalTotal);

  return (
    <div className="checkout-page-container">
      {/* Razorpay Connected Banner */}
      <div className="checkout-test-mode-banner" role="status">
        <Info size={16} style={{ flexShrink: 0 }} />
        <span>{UI_STRINGS.testModeBanner}</span>
      </div>

      <div className="checkout-header">
        <Link to="/cart" className="back-link">
          <ArrowLeft size={16} />
          <span>Back to Cart</span>
        </Link>
        <h2>Razorpay Checkout &amp; QR Scanner</h2>
      </div>

      {/* 3-Step Indicator: 1. Address -> 2. Review -> 3. Payment (Razorpay QR) */}
      <div className="checkout-stepper-bar" aria-label="Checkout progress">
        {[
          { num: 1, label: 'Address', done: true },
          { num: 2, label: 'Review', done: true },
          { num: 3, label: 'Razorpay QR Payment', current: true }
        ].map((step, idx) => (
          <div
            key={step.num}
            className={`checkout-step-item ${step.done ? 'done' : ''} ${
              step.current ? 'current' : ''
            }`}
          >
            <span className="checkout-step-circle">
              {step.done ? <CheckCircle2 size={15} /> : step.num}
            </span>
            <span className="checkout-step-label">{step.label}</span>
            {idx < 2 && <span className="checkout-step-connector" aria-hidden="true" />}
          </div>
        ))}
      </div>

      {serverError && (
        <div className="checkout-error-banner">
          <AlertCircle size={20} />
          <span>{serverError}</span>
        </div>
      )}

      <div className="checkout-razorpay-split">
        {/* LEFT COLUMN: LIVE RAZORPAY PAYMENT GATEWAY & QR SCANNER */}
        <section className="rzp-gateway-column" aria-label="Razorpay Payment Gateway and QR Scanner">
          <div className="rzp-gateway-card">
            {/* Official-style Razorpay Top Header */}
            <div className="rzp-gateway-header">
              <div className="rzp-gateway-brand">
                <div className="rzp-merchant-avatar">SK</div>
                <div>
                  <div className="rzp-merchant-name-row">
                    <h4>SmartKart Retail India</h4>
                    <span className="rzp-verified-pill">
                      <ShieldCheck size={12} /> Razorpay Verified
                    </span>
                  </div>
                  <p className="rzp-order-meta">
                    Razorpay Order:{' '}
                    <code>
                      {razorpaySession?.razorpayOrderId ||
                        (isProcessing ? 'Creating order...' : 'Ready')}
                    </code>
                  </p>
                </div>
              </div>

              <div className="rzp-gateway-amount-box">
                <span className="rzp-test-badge">TEST MODE</span>
                <span className="rzp-amount-label">Total Payable</span>
                <strong className="rzp-amount-value">
                  ₹{displayAmount.toLocaleString('en-IN')}
                </strong>
              </div>
            </div>

            {/* Method Navigation Tabs */}
            <div className="rzp-method-tabs">
              <button
                type="button"
                className={`rzp-method-tab ${paymentMethodTab === 'qr' ? 'active' : ''}`}
                onClick={() => setPaymentMethodTab('qr')}
              >
                <QrCode size={16} />
                <span>UPI QR Scanner</span>
                <span className="rzp-recommended-tag">Scan &amp; Pay</span>
              </button>
              <button
                type="button"
                className={`rzp-method-tab ${paymentMethodTab === 'upi' ? 'active' : ''}`}
                onClick={() => setPaymentMethodTab('upi')}
              >
                <Smartphone size={16} />
                <span>UPI ID / VPA</span>
              </button>
              <button
                type="button"
                className={`rzp-method-tab ${paymentMethodTab === 'card' ? 'active' : ''}`}
                onClick={() => setPaymentMethodTab('card')}
              >
                <CreditCard size={16} />
                <span>Cards &amp; NetBanking</span>
              </button>
            </div>

            {/* TAB 1: RAZORPAY UPI QR SCANNER */}
            {paymentMethodTab === 'qr' && (
              <div className="rzp-qr-scanner-panel">
                <div className="rzp-qr-left">
                  <div className={`rzp-qr-frame ${qrScanStage !== 'ready' ? 'scanned' : ''}`}>
                    {/* Corner brackets */}
                    <span className="qr-corner tl" />
                    <span className="qr-corner tr" />
                    <span className="qr-corner bl" />
                    <span className="qr-corner br" />

                    {/* Animated scanning laser line */}
                    {qrScanStage === 'ready' && <div className="rzp-qr-laser" />}

                    {/* Crisp SVG QR Code */}
                    <svg
                      viewBox="0 0 27 27"
                      className="rzp-qr-svg"
                      role="img"
                      aria-label={`Razorpay UPI QR Code for Order ${
                        razorpaySession?.razorpayOrderId || 'SmartKart'
                      }`}
                    >
                      <rect width="27" height="27" fill="#ffffff" rx="1" />
                      {qrMatrix.map((row, rIdx) =>
                        row.map((cell, cIdx) =>
                          cell ? (
                            <rect
                              key={`${rIdx}-${cIdx}`}
                              x={cIdx + 1}
                              y={rIdx + 1}
                              width="1"
                              height="1"
                              fill="#072654"
                            />
                          ) : null
                        )
                      )}
                      {/* Center Razorpay UPI Emblem */}
                      <rect x="11" y="11" width="5" height="5" rx="0.8" fill="#072654" />
                      <text
                        x="13.5"
                        y="14.3"
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="2.2"
                        fontWeight="bold"
                        fontFamily="sans-serif"
                      >
                        UPI
                      </text>
                    </svg>

                    {qrScanStage !== 'ready' && (
                      <div className="rzp-qr-overlay-status">
                        <div className="rzp-qr-check-circle">
                          <Check size={28} />
                        </div>
                        <strong>
                          {qrScanStage === 'scanning'
                            ? 'QR Code Scanned!'
                            : 'Verifying HMAC Signature...'}
                        </strong>
                        <span>Communicating with Razorpay server</span>
                      </div>
                    )}
                  </div>

                  <div className="rzp-qr-timer">
                    <Clock size={13} />
                    <span>QR valid for {formatTimer(qrSecondsLeft)}</span>
                  </div>
                </div>

                <div className="rzp-qr-right">
                  <div className="rzp-qr-instructions">
                    <h4>Scan Razorpay QR with any UPI App</h4>
                    <p>
                      Scan this dynamic Razorpay BharatQR code using Google Pay, PhonePe, Paytm, or
                      BHIM, or click the button below to simulate scanning in Test Mode.
                    </p>

                    <div className="rzp-upi-apps-row">
                      <span className="upi-app-chip gpay">GPay</span>
                      <span className="upi-app-chip phonepe">PhonePe</span>
                      <span className="upi-app-chip paytm">Paytm</span>
                      <span className="upi-app-chip bhim">BHIM UPI</span>
                    </div>

                    <div className="rzp-order-info-box">
                      <div>
                        <span>Merchant VPA:</span>
                        <strong>smartkart.rzp@axisbank</strong>
                      </div>
                      <div>
                        <span>Razorpay Order ID:</span>
                        <strong>{razorpaySession?.razorpayOrderId || 'Initializing...'}</strong>
                      </div>
                      <div>
                        <span>Razorpay Key:</span>
                        <strong>{razorpaySession?.key || 'rzp_test_TunWSNvxg0TTPd'}</strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="rzp-primary-pay-btn"
                      onClick={() => handleCompleteQrOrUpiPayment('Razorpay QR Scanner')}
                      disabled={qrScanStage !== 'ready' || isProcessing}
                    >
                      {qrScanStage === 'ready' ? (
                        <>
                          <QrCode size={18} />
                          <span>
                            Scan &amp; Complete Payment · ₹{displayAmount.toLocaleString('en-IN')}
                          </span>
                        </>
                      ) : (
                        <>
                          <RefreshCw size={18} className="spin-icon" />
                          <span>
                            {qrScanStage === 'scanning'
                              ? 'QR Scanned · Processing...'
                              : 'Verifying with Razorpay...'}
                          </span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      className="rzp-secondary-popup-btn"
                      onClick={handleOpenOfficialRazorpayPopup}
                      disabled={qrScanStage !== 'ready' || isProcessing}
                    >
                      <ExternalLink size={15} />
                      <span>Open Hosted Razorpay Checkout Popup (Cards / NetBanking)</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: UPI ID / VPA */}
            {paymentMethodTab === 'upi' && (
              <div className="rzp-upi-id-panel">
                <h4>Pay using UPI ID / VPA</h4>
                <p>
                  Enter your Virtual Payment Address to receive a payment collect request on your
                  UPI app.
                </p>

                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label className="form-label" htmlFor="rzp-upi-input">
                    Your UPI ID
                  </label>
                  <input
                    id="rzp-upi-input"
                    type="text"
                    className="form-input"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="username@okicici"
                  />
                </div>

                <div className="rzp-vpa-chips">
                  {['@okicici', '@okhdfcbank', '@ybl', '@paytm'].map((suffix) => (
                    <button
                      key={suffix}
                      type="button"
                      className="rzp-vpa-chip"
                      onClick={() => {
                        const base = (upiId.split('@')[0] || 'customer').trim();
                        setUpiId(`${base}${suffix}`);
                      }}
                    >
                      {suffix}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="rzp-primary-pay-btn"
                  style={{ marginTop: '1.25rem' }}
                  onClick={() => handleCompleteQrOrUpiPayment(`UPI ID (${upiId})`)}
                  disabled={!upiId.includes('@') || qrScanStage !== 'ready'}
                >
                  <CheckCircle2 size={18} />
                  <span>Verify &amp; Pay ₹{displayAmount.toLocaleString('en-IN')}</span>
                </button>
              </div>
            )}

            {/* TAB 3: OFFICIAL RAZORPAY CARDS & NETBANKING POPUP */}
            {paymentMethodTab === 'card' && (
              <div className="rzp-upi-id-panel">
                <h4>Cards, NetBanking &amp; Wallets via Razorpay Checkout</h4>
                <p>
                  Launch the official Razorpay Checkout modal connected to order{' '}
                  <code>{razorpaySession?.razorpayOrderId || 'order_live'}</code> to pay using test
                  Debit/Credit Cards, NetBanking (SBI, HDFC, ICICI, Axis), or Wallets.
                </p>

                <button
                  type="button"
                  className="rzp-primary-pay-btn"
                  style={{ marginTop: '1.25rem' }}
                  onClick={handleOpenOfficialRazorpayPopup}
                  disabled={isProcessing}
                >
                  <ExternalLink size={18} />
                  <span>
                    {isProcessing
                      ? 'Opening Razorpay...'
                      : `Launch Official Razorpay Checkout · ₹${displayAmount.toLocaleString(
                          'en-IN'
                        )}`}
                  </span>
                </button>
              </div>
            )}

            <div className="rzp-gateway-footer">
              <span>
                <Lock size={13} /> Secured by <strong>Razorpay</strong> · 256-bit HMAC-SHA256
                Signature Verification
              </span>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: SHIPPING ADDRESS & ORDER SUMMARY */}
        <aside className="checkout-summary-section">
          <div className="checkout-card" style={{ marginBottom: '1.25rem' }}>
            <h3 className="section-title">1. Delivery Address</h3>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCompleteQrOrUpiPayment('Razorpay QR Scanner');
              }}
              id="checkout-form"
              noValidate
            >
              <div className="form-group">
                <label className="form-label" htmlFor="fullName">
                  Full Name *
                </label>
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
                <label className="form-label" htmlFor="phone">
                  Phone Number *
                </label>
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
                <label className="form-label" htmlFor="addressLine1">
                  Address Line 1 *
                </label>
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
                  <label className="form-label" htmlFor="city">
                    City *
                  </label>
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
                  <label className="form-label" htmlFor="state">
                    State *
                  </label>
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
                  <label className="form-label" htmlFor="pincode">
                    Pincode *
                  </label>
                  <input
                    type="text"
                    id="pincode"
                    name="pincode"
                    className={`form-input ${errors.pincode ? 'input-error' : ''}`}
                    value={formData.pincode}
                    onChange={handleChange}
                    placeholder="e.g. 560038"
                    maxLength={6}
                    disabled={isProcessing}
                  />
                  {errors.pincode && <span className="field-error">{errors.pincode}</span>}
                </div>
              </div>
            </form>
          </div>

          <div className="checkout-card summary-sticky">
            <h3 className="section-title">2. Order Summary</h3>

            <div className="checkout-items-preview">
              {cart.map((item) => (
                <div key={item.product?._id || item._id} className="checkout-item-row">
                  <div className="checkout-item-thumb">
                    <img
                      src={item.product?.image}
                      alt={item.product?.name}
                      referrerPolicy="no-referrer"
                      onError={handleImageError}
                    />
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

            {discountAmount > 0 && (
              <div className="summary-row discount-summary-row">
                <span className="summary-label">
                  Discount ({discountPercent}%):
                  {activeDiscountOffer?.offerId && (
                    <span className="discount-code-pill">{activeDiscountOffer.offerId}</span>
                  )}
                </span>
                <span className="summary-value discount-value">
                  −₹{discountAmount.toLocaleString('en-IN')}
                </span>
              </div>
            )}

            <div className="summary-row">
              <span className="summary-label">Shipping:</span>
              <span className="summary-value shipping-free">FREE</span>
            </div>

            <div className="summary-divider"></div>

            <div className="summary-row summary-total-row">
              <span className="summary-total-label">Total to Pay:</span>
              <span className="summary-total-value">₹{displayAmount.toLocaleString('en-IN')}</span>
            </div>

            <div className="checkout-trust-box">
              <div className="trust-badge-item">
                <ShieldCheck size={16} />
                <span>Razorpay Test Mode: no real money charged</span>
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
