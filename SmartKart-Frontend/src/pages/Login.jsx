import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Sparkles, ShieldCheck, Tag, ArrowRight, Eye, EyeOff } from 'lucide-react';
import api, { setAuthToken } from '../services/api';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import UI_STRINGS from '../constants/uiStrings';

function Login() {
  const navigate = useNavigate();
  const { fetchCart } = useCart();
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
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

  const performLogin = async (credentials) => {
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/login', credentials);
      if (res.data?.token) {
        setAuthToken(res.data.token);
      }
      await fetchCart();
      showToast('Welcome back to SmartKart!', 'success');
      navigate('/home');
    } catch (err) {
      if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message);
      } else {
        setError(`Invalid email or password. Or click "${UI_STRINGS.tryDemoAccount}" below.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await performLogin(formData);
  };

  const handleDemoLogin = async () => {
    const demoCreds = {
      email: 'demo@smartkart.com',
      password: 'password123'
    };
    setFormData(demoCreds);
    await performLogin(demoCreds);
  };

  return (
    <div className="auth-split-layout">
      <div className="auth-showcase-panel">
        <div className="auth-showcase-badge">
          <Sparkles size={14} />
          <span>{UI_STRINGS.brandName}</span>
        </div>
        <h1 className="auth-showcase-title">
          Shop by goal, check your cart for trade-offs &amp; ask for a bundle discount.
        </h1>
        <p className="auth-showcase-desc">
          Browse 38 curated products directly, or build a suggested bundle within your budget before
          adding items to your cart.
        </p>

        <div className="auth-feature-list">
          <div className="auth-feature-item">
            <span className="auth-feature-icon">
              <Sparkles size={18} />
            </span>
            <div>
              <strong>{UI_STRINGS.shopByGoal}</strong>
              <p>
                Describe your setup or budget in plain English to build a suggested bundle that
                never changes your cart until you approve.
              </p>
            </div>
          </div>
          <div className="auth-feature-item">
            <span className="auth-feature-icon">
              <ShieldCheck size={18} />
            </span>
            <div>
              <strong>
                {UI_STRINGS.checkMyCart} ({UI_STRINGS.smartPurchaseCheck})
              </strong>
              <p>
                See honest product trade-offs, verified buyer ratings, and 1-click swaps before
                you pay.
              </p>
            </div>
          </div>
          <div className="auth-feature-item">
            <span className="auth-feature-icon">
              <Tag size={18} />
            </span>
            <div>
              <strong>{UI_STRINGS.askForDiscount} (Up to 15% Off)</strong>
              <p>
                Buying multiple items? Ask for a discount inside your Cart Order Summary, locked to
                your current cart items.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-card">
        <div className="auth-header">
          <h2 className="auth-title">Welcome Back</h2>
          <p className="auth-subtitle">Sign in to your {UI_STRINGS.brandName} account</p>
        </div>

        <div className="demo-quick-card">
          <div className="demo-quick-info">
            <span className="demo-pill">Quick Start</span>
            <p>Want to test SmartKart right away? Sign in with our pre-configured demo account.</p>
          </div>
          <button
            type="button"
            className="btn btn-primary demo-login-btn"
            style={{ width: '100%' }}
            onClick={handleDemoLogin}
            disabled={loading}
          >
            <span>{loading ? 'Signing in...' : UI_STRINGS.tryDemoAccount}</span>
            <ArrowRight size={16} />
          </button>
        </div>

        <div className="auth-divider">
          <span>or sign in with email</span>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
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
              placeholder="demo@smartkart.com"
              autoComplete="email"
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
                placeholder="Enter your password"
                autoComplete="current-password"
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
            className="btn btn-outline"
            style={{ width: '100%', padding: '0.85rem' }}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In with Email'}
          </button>
        </form>

        <div className="auth-footer-links">
          <span>Don&apos;t have an account? </span>
          <Link to="/register">Create an account</Link>
        </div>
      </div>
    </div>
  );
}

export default Login;
