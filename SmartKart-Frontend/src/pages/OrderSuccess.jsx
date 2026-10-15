import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle2, ShoppingBag, ArrowRight } from 'lucide-react';
import { orderApi } from '../services/api';

const OrderSuccess = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const response = await orderApi.get(`/${id}`);
        setOrder(response.data.order);
      } catch (err) {
        console.error('Failed to load order success details:', err);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchOrder();
    }
  }, [id]);

  return (
    <div className="order-success-container">
      <div className="order-success-card">
        <div className="success-icon-wrapper">
          <CheckCircle2 size={64} color="#15803d" />
        </div>

        <h1 className="success-title">Order Placed Successfully!</h1>
        <p className="success-message">
          Thank you for your purchase. Your order has been placed and confirmed.
        </p>

        <div className="order-receipt-box">
          <div className="receipt-row">
            <span className="receipt-label">Order ID:</span>
            <span className="receipt-value order-id-highlight">{id}</span>
          </div>

          {order && (
            <>
              <div className="receipt-row">
                <span className="receipt-label">Order Date:</span>
                <span className="receipt-value">
                  {new Date(order.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </span>
              </div>

              <div className="receipt-row">
                <span className="receipt-label">Payment Status:</span>
                <span className="badge badge-success">{order.paymentStatus}</span>
              </div>

              <div className="receipt-row">
                <span className="receipt-label">Order Status:</span>
                <span className="badge badge-placed">{order.status}</span>
              </div>

              <div className="receipt-row">
                <span className="receipt-label">Delivery To:</span>
                <span className="receipt-value">
                  {order.shippingAddress?.fullName}, {order.shippingAddress?.city} ({order.shippingAddress?.pincode})
                </span>
              </div>

              <div className="receipt-divider"></div>

              <div className="receipt-items-list">
                <h4 className="receipt-items-title">Purchased Items ({order.items?.length}):</h4>
                {order.items?.map((item, idx) => (
                  <div key={idx} className="receipt-item">
                    <span className="receipt-item-name">
                      {item.name} × {item.quantity}
                    </span>
                    <span className="receipt-item-price">
                      ₹{((item.price || 0) * (item.quantity || 1)).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>

              <div className="receipt-divider"></div>

              <div className="receipt-row receipt-total-row">
                <span className="receipt-total-label">Total Paid:</span>
                <span className="receipt-total-amount">
                  ₹{(order.totalAmount || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="success-actions">
          <Link to="/orders" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>View My Orders</span>
            <ArrowRight size={16} />
          </Link>
          <Link to="/products" className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShoppingBag size={16} />
            <span>Continue Shopping</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default OrderSuccess;
