import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Package, ArrowRight, Clock, AlertCircle } from 'lucide-react';
import { orderApi } from '../services/api';

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
      <div className="orders-page-container">
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
          <h2>Unable to load your orders.</h2>
          <p style={{ margin: '1rem 0' }}>{error}</p>
          <button className="btn btn-primary" onClick={fetchOrders}>
            Try Again
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
          <h2>You have not placed any orders yet.</h2>
          <p className="empty-orders-subtitle">
            Once you complete a purchase, your order history and tracking will appear here.
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
          &larr; Browse Catalog
        </Link>
      </div>

      <div className="orders-list">
        {orders.map((order) => {
          const dateStr = new Date(order.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          });

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
                  <span className={`status-pill status-${order.status.toLowerCase()}`}>
                    {order.status}
                  </span>
                  <span className={`payment-pill payment-${order.paymentStatus.toLowerCase()}`}>
                    {order.paymentStatus}
                  </span>
                </div>
              </div>

              <div className="order-items-preview-list">
                {order.items?.map((item, idx) => (
                  <div key={idx} className="order-item-snippet">
                    {item.image && (
                      <div className="order-item-tiny-thumb">
                        <img src={item.image} alt={item.name} />
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
                  <span className="order-total-muted">Total:</span>
                  <span className="order-total-figure">
                    ₹{(order.totalAmount || 0).toLocaleString('en-IN')}
                  </span>
                </div>

                <Link to={`/orders/${order._id}`} className="btn btn-outline order-details-btn">
                  <span>View Details</span>
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
