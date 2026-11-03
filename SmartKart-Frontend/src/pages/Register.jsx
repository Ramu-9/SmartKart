import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Sparkles, ShieldCheck } from 'lucide-react';
import api, { setAuthToken } from '../services/api';
import { useCart } from '../context/CartContext';

function Register() {
  const navigate = useNavigate();
  const { fetchCart } = useCart();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    phone: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.post('/register', formData);
      if (res.data?.token) {
        setAuthToken(res.data.token);
        await fetchCart();
        navigate('/home');
      } else {
        navigate('/login');
      }
    } catch (err) {
      if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message);
      } else {
        setError('Registration failed. Please check your details and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-split-layout">
      <div className="auth-showcase-panel">
        <div className="auth-showcase-badge">
          <Sparkles size={14} />
          <span>Create Your SmartKart Account</span>
        </div>
        <h1 className="auth-showcase-title">
          Unlock personalized shopping proposals, verified reviews &amp; bundle deals.
        </h1>
        <p className="auth-showcase-desc">
          Your SmartKart account keeps your cart, wishlist, negotiated discounts, and order history synchronized across sessions.
        </p>

        <div className="auth-feature-list">
          <div className="auth-feature-item">
            <span className="auth-feature-icon">
              <Sparkles size={18} />
            </span>
            <div>
              <strong>Save &amp; Approve AI Proposals</strong>
              <p>
                Turn natural-language mission plans into real cart items only when you approve them.
              </p>
            </div>
          </div>
          <div className="auth-feature-item">
            <span className="auth-feature-icon">
              <ShieldCheck size={18} />
            </span>
            <div>
              <strong>Verified Purchase Reviews</strong>
              <p>
                Reviews on products you have purchased automatically earn the VERIFIED PURCHASE badge.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-card">
        <div className="auth-header">
          <h2 className="auth-title">Create Account</h2>
          <p className="auth-subtitle">Join SmartKart in seconds</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="fullName">
              Full Name
            </label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              className="form-input"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="Aarav Sharma"
              autoComplete="name"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              className="form-input"
              value={formData.email}
              onChange={handleChange}
              placeholder="aarav@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="phone">
              Phone Number
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              className="form-input"
              value={formData.phone}
              onChange={handleChange}
              placeholder="9876543210"
              autoComplete="tel"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Password
            </label>
            <div className="password-field-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                className="form-input with-password-toggle"
                value={formData.password}
                onChange={handleChange}
                placeholder="Minimum 6 characters"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer-links">
          <span>Already have an account? </span>
          <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}

export default Register;
