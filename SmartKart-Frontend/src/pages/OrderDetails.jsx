import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, CreditCard, CheckCircle2 } from 'lucide-react';
import { orderApi } from '../services/api';

const OrderDetails = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchOrder = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await orderApi.get(`/${id}`);
      setOrder(response.data.order);
    } catch (err) {
      if (err.response?.status === 403) {
        setError('Access denied. You do not own this order.');
      } else if (err.response?.status === 404) {
        setError('Order not found.');
      } else {
        setError(err.response?.data?.message || err.message || 'Unable to load order details.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchOrder();
    }
  }, [id]);

  const handleStatusChange = async (newStatus) => {
    if (updatingStatus) return;
    setUpdatingStatus(true);
    try {
      const response = await orderApi.patch(`/${id}/status`, { status: newStatus });
      setOrder(response.data.order);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update order status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="orders-page-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <h2>Loading order details...</h2>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="orders-page-container">
        <div className="error-state">
          <h2>Error</h2>
          <p style={{ margin: '1rem 0' }}>{error || 'Order not found'}</p>
          <Link to="/orders" className="btn btn-primary">
            Back to My Orders
          </Link>
        </div>
      </div>
    );
  }

  const steps = ['PLACED', 'CONFIRMED', 'SHIPPED', 'DELIVERED'];
  const currentStepIndex = steps.indexOf(order.status);

  return (
    <div className="orders-page-container">
      <div className="order-details-header">
        <Link to="/orders" className="back-link">
          <ArrowLeft size={16} />
          <span>Back to My Orders</span>
        </Link>
        <div className="order-details-meta">
          <h2>Order #{order._id}</h2>
          <span className="order-date-text">
            Placed on {new Date(order.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        </div>
      </div>

      <div className="status-tracker-card">
        <h4 className="tracker-title">Order Status</h4>
        <div className="tracker-stepper">
          {steps.map((step, index) => {
            const isCompleted = currentStepIndex >= index;
            const isCurrent = currentStepIndex === index;

            return (
              <div key={step} className={`step-item ${isCompleted ? 'step-completed' : ''} ${isCurrent ? 'step-active' : ''}`}>
                <div className="step-circle">
                  {isCompleted ? <CheckCircle2 size={16} /> : index + 1}
                </div>
                <span className="step-label">{step}</span>
                {index < steps.length - 1 && <div className="step-line"></div>}
              </div>
            );
          })}
        </div>

        <div className="status-progression-bonus">
          <span className="bonus-label">Order Status Progression:</span>
          <div className="status-buttons-group">
            {steps.map((st) => (
              <button
                key={st}
                type="button"
                className={`bonus-status-btn ${order.status === st ? 'active' : ''}`}
                onClick={() => handleStatusChange(st)}
                disabled={updatingStatus || order.status === st}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="order-details-layout">
        <div className="order-details-items-card">
          <h3 className="section-title">Purchased Items ({order.items?.length})</h3>
          <div className="order-details-items-list">
            {order.items?.map((item, idx) => (
              <div key={idx} className="details-item-row">
                <div className="details-item-thumb">
                  <img src={item.image} alt={item.name} />
                </div>
                <div className="details-item-info">
                  <h4 className="details-item-name">{item.name}</h4>
                  <span className="details-item-unit-price">
                    ₹{(item.price || 0).toLocaleString('en-IN')} × {item.quantity}
                  </span>
                </div>
                <div className="details-item-line-total">
                  ₹{((item.price || 0) * (item.quantity || 1)).toLocaleString('en-IN')}
                </div>
              </div>
            ))}
          </div>

          <div className="order-cost-breakdown">
            <div className="breakdown-row">
              <span>Subtotal:</span>
              <span>₹{(order.subtotalAmount || order.totalAmount || 0).toLocaleString('en-IN')}</span>
            </div>
            {order.discountAmount > 0 && (
              <div className="breakdown-row discount-summary-row">
                <span>Negotiated Discount ({order.discountPercent || 0}%):</span>
                <span className="discount-value">−₹{(order.discountAmount || 0).toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="breakdown-row">
              <span>Delivery Fee:</span>
              <span className="shipping-free">FREE</span>
            </div>
            <div className="summary-divider"></div>
            <div className="breakdown-row breakdown-total">
              <span>Total Paid:</span>
              <span className="total-accent">₹{(order.totalAmount || 0).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        <div className="order-details-sidebar">
          <div className="sidebar-card">
            <div className="card-header-with-icon">
              <MapPin size={20} />
              <h4>Delivery Address</h4>
            </div>
            <p className="address-name">{order.shippingAddress?.fullName}</p>
            <p className="address-text">{order.shippingAddress?.addressLine1}</p>
            <p className="address-text">
              {order.shippingAddress?.city}, {order.shippingAddress?.state} - {order.shippingAddress?.pincode}
            </p>
            <p className="address-phone">Phone: {order.shippingAddress?.phone}</p>
          </div>

          <div className="sidebar-card">
            <div className="card-header-with-icon">
              <CreditCard size={20} />
              <h4>Payment Information</h4>
            </div>
            {(() => {
              const isSimulated = Boolean(
                order.isSimulatedPayment ||
                  order.paymentMode === 'DEMO_SIMULATION' ||
                  (String(order.razorpayOrderId || '').startsWith('order_sim_') &&
                    !order.razorpayPaymentId)
              );
              return (
                <>
                  <div className="info-pair">
                    <span className="info-label">Payment Method:</span>
                    <span className="info-value">
                      {isSimulated
                        ? 'Simulated Demo Payment (Not Razorpay)'
                        : 'Razorpay (Test Mode)'}
                    </span>
                  </div>
                  <div className="info-pair">
                    <span className="info-label">Payment Status:</span>
                    <span className="badge badge-success">
                      {isSimulated ? 'PAID (SIMULATED DEMO)' : order.paymentStatus}
                    </span>
                  </div>
                  {order.razorpayPaymentId && !isSimulated && (
                    <div className="info-pair">
                      <span className="info-label">Razorpay Payment ID:</span>
                      <span className="info-value code-snippet">{order.razorpayPaymentId}</span>
                    </div>
                  )}
                  {order.simulatedPaymentId && isSimulated && (
                    <div className="info-pair">
                      <span className="info-label">Simulated Ref:</span>
                      <span className="info-value code-snippet">{order.simulatedPaymentId}</span>
                    </div>
                  )}
                  {order.razorpayOrderId && (
                    <div className="info-pair">
                      <span className="info-label">
                        {isSimulated ? 'Demo Order Ref:' : 'Razorpay Order:'}
                      </span>
                      <span className="info-value code-snippet">{order.razorpayOrderId}</span>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetails;
