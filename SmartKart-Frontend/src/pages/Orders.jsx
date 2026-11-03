import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, CheckCircle2, RotateCcw, AlertCircle } from 'lucide-react';
import { orderApi } from '../services/api';
import { handleImageError } from '../utils/imageFallback';

const ORDER_STEPS = ['PLACED', 'CONFIRMED', 'SHIPPED', 'DELIVERED'];

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await orderApi.get('/');
      setOrders(response.data.orders || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to load orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  if (loading) {
    return (
      <div className="orders-page-container" aria-busy="true">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <h2>Loading your orders...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="orders-page-container">
        <div className="error-state">
          <AlertCircle size={32} style={{ margin: '0 auto 0.75rem', color: 'var(--error-color)' }} />
          <h2>Unable to load your orders</h2>
          <p style={{ margin: '0.75rem 0 1.25rem' }}>{error}</p>
          <button className="btn btn-primary btn-inline" onClick={fetchOrders}>
            <RotateCcw size={15} />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="orders-page-container">
        <div className="orders-empty-state">
          <div className="empty-orders-icon">📦</div>
          <h2>You have not placed any orders yet</h2>
          <p className="empty-orders-subtitle">
            Once you complete a purchase, your order history and status timeline will appear here.
          </p>
          <Link to="/products" className="btn btn-primary browse-btn">
            Start Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="orders-page-container">
      <div className="orders-page-header">
        <div>
          <h2>My Orders</h2>
          <p className="orders-header-subtitle">
            You have placed {orders.length} {orders.length === 1 ? 'order' : 'orders'}
          </p>
        </div>
        <Link to="/products" className="continue-shopping-link">
          &larr; Browse Catalogue
        </Link>
      </div>

      <div className="orders-list">
        {orders.map((order) => {
          const dateStr = new Date(order.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          });

          const currentStepIdx = Math.max(0, ORDER_STEPS.indexOf(order.status || 'PLACED'));

          return (
            <div key={order._id} className="order-history-card">
              <div className="order-history-header">
                <div>
                  <span className="order-number-title">Order #{order._id.slice(-8)}</span>
                  <div className="order-date-text">
                    <Clock size={14} />
                    <span>{dateStr}</span>
                  </div>
                </div>

                <div className="order-status-group">
                  <span className={`status-pill status-${(order.status || 'placed').toLowerCase()}`}>
                    {order.status}
                  </span>
                  <span
                    className={`payment-pill payment-${(
                      order.paymentStatus || 'paid'
                    ).toLowerCase()}`}
                  >
                    {order.paymentStatus}
                  </span>
                </div>
              </div>

              {/* Compact Order Status Timeline */}
              <div className="order-card-timeline" aria-label={`Order status: ${order.status}`}>
                {ORDER_STEPS.map((st, idx) => {
                  const done = currentStepIdx >= idx;
                  const active = currentStepIdx === idx;
                  return (
                    <div
                      key={st}
                      className={`mini-timeline-step ${done ? 'done' : ''} ${
                        active ? 'active' : ''
                      }`}
                    >
                      <span className="mini-timeline-dot">
                        {done ? <CheckCircle2 size={12} /> : idx + 1}
                      </span>
                      <span className="mini-timeline-label">{st}</span>
                      {idx < ORDER_STEPS.length - 1 && (
                        <span className="mini-timeline-line" aria-hidden="true" />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="order-items-preview-list">
                {order.items?.map((item, idx) => (
                  <div key={idx} className="order-item-snippet">
                    {item.image && (
                      <div className="order-item-tiny-thumb">
                        <img
                          src={item.image}
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          onError={handleImageError}
                        />
                      </div>
                    )}
                    <span className="order-item-snippet-name">{item.name}</span>
                    <span className="order-item-snippet-qty">× {item.quantity}</span>
                    <span className="order-item-snippet-price">
                      ₹{((item.price || 0) * (item.quantity || 1)).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>

              <div className="order-history-footer">
                <div className="order-total-info">
                  <span className="order-total-muted">Total Paid:</span>
                  <span className="order-total-figure">
                    ₹{(order.totalAmount || 0).toLocaleString('en-IN')}
                  </span>
                </div>

                <Link to={`/orders/${order._id}`} className="btn btn-outline order-details-btn">
                  <span>View Details &amp; Timeline</span>
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Orders;
