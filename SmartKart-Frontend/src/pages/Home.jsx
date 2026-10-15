import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone } from 'lucide-react';
import api from '../services/api';

function Home() {
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCustomerData = async () => {
      try {
        const response = await api.get('/me');
        setCustomer(response.data);
      } catch (err) {

        console.error('Failed to fetch user:', err);
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };

    fetchCustomerData();
  }, [navigate]);

  if (loading) {
    return (
      <div className="dashboard-container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Welcome back, {customer?.fullName?.split(' ')[0]}</h1>
        <p className="auth-subtitle">Here is your account overview.</p>
      </div>

      <div className="profile-card">
        <div className="profile-item">
          <div className="profile-icon">
            <User size={20} />
          </div>
          <div className="profile-content">
            <div className="profile-label">Full Name</div>
            <div className="profile-value">{customer?.fullName}</div>
          </div>
        </div>

        <div className="profile-item">
          <div className="profile-icon">
            <Mail size={20} />
          </div>
          <div className="profile-content">
            <div className="profile-label">Email Address</div>
            <div className="profile-value">{customer?.email}</div>
          </div>
        </div>

        <div className="profile-item">
          <div className="profile-icon">
            <Phone size={20} />
          </div>
          <div className="profile-content">
            <div className="profile-label">Phone Number</div>
            <div className="profile-value">{customer?.phone}</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <button 
          className="btn btn-primary" 
          onClick={() => navigate('/products')}
          style={{ width: 'auto', padding: '1rem 3rem' }}
        >
          Start Shopping
        </button>
      </div>
    </div>
  );
}

export default Home;
