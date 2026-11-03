import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import {
  ShoppingCart,
  LogOut,
  Heart,
  Package,
  Sparkles,
  LogIn,
  UserPlus,
  User,
  Menu,
  X,
  Search,
  ChevronDown,
  HelpCircle,
  Store
} from 'lucide-react';
import api, { wishlistApi, clearAuthToken, getAuthToken, setAuthToken } from '../services/api';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import UI_STRINGS from '../constants/uiStrings';

function Navbar({ onOpenTour }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const { totalCount, finalTotal, clearCart, fetchCart } = useCart();

  const [wishlistCount, setWishlistCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [navSearch, setNavSearch] = useState(searchParams.get('search') || '');
  const [demoLoading, setDemoLoading] = useState(false);
  const dropdownRef = useRef(null);

  const isAuthRoute = location.pathname === '/login' || location.pathname === '/register';
  const hasToken = Boolean(getAuthToken());

  useEffect(() => {
    const q = searchParams.get('search');
    if (location.pathname === '/products' && q !== null) {
      setNavSearch(q);
    }
  }, [location.pathname, searchParams]);

  const fetchWishlistCount = async () => {
    try {
      const response = await wishlistApi.get('/');
      setWishlistCount(response.data.count || 0);
    } catch {
      // Guest or not logged in
    }
  };

  useEffect(() => {
    setMobileMenuOpen(false);
    setAccountDropdownOpen(false);
    if (!isAuthRoute) {
      fetchWishlistCount();
    }

    const handleWishlistUpdate = () => {
      fetchWishlistCount();
    };

    window.addEventListener('wishlistUpdated', handleWishlistUpdate);
    return () => {
      window.removeEventListener('wishlistUpdated', handleWishlistUpdate);
    };
  }, [location.pathname, isAuthRoute]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setAccountDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNavSearchSubmit = (e) => {
    e.preventDefault();
    const trimmed = navSearch.trim();
    if (trimmed) {
      navigate(`/products?search=${encodeURIComponent(trimmed)}`);
    } else {
      navigate('/products');
    }
    setMobileMenuOpen(false);
  };

  const handleTryDemoAccount = async () => {
    setDemoLoading(true);
    try {
      const res = await api.post('/login', {
        email: 'demo@smartkart.com',
        password: 'password123'
      });
      if (res.data?.token) {
        setAuthToken(res.data.token);
      }
      await fetchCart();
      fetchWishlistCount();
      setAccountDropdownOpen(false);
      setMobileMenuOpen(false);
      showToast('Signed in with Demo Account', 'success');
      if (isAuthRoute) {
        navigate('/home');
      }
    } catch {
      navigate('/login');
    } finally {
      setDemoLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('/logout');
    } catch {
      // Ignore logout network error
    } finally {
      clearAuthToken();
      clearCart();
      setWishlistCount(0);
      setAccountDropdownOpen(false);
      setMobileMenuOpen(false);
      showToast('Signed out', 'info');
      navigate('/login');
    }
  };

  const isActive = (path) => {
    if (path === '/home') return location.pathname === '/home';
    return location.pathname.startsWith(path);
  };

  return (
    <header className="navbar">
      <div className="navbar-inner">
        {/* 1. Brand Logo */}
        <Link to="/home" className="navbar-brand" aria-label="SmartKart Home">
          <span className="brand-logo-box">
            <ShoppingCart size={17} color="#FFFFFF" strokeWidth={2.2} />
          </span>
          <span>{UI_STRINGS.brandName}</span>
        </Link>

        {/* 2. Global Search Bar (Always Visible) */}
        <form
          onSubmit={handleNavSearchSubmit}
          className="navbar-search-form"
          role="search"
          aria-label="Search catalogue products"
        >
          <Search size={16} className="navbar-search-icon" />
          <input
            type="search"
            className="navbar-search-input"
            placeholder="Search 38 products, brands, or categories..."
            aria-label="Search products"
            value={navSearch}
            onChange={(e) => setNavSearch(e.target.value)}
          />
          {navSearch && (
            <button
              type="button"
              className="navbar-search-clear"
              onClick={() => {
                setNavSearch('');
                if (location.pathname === '/products') {
                  navigate('/products');
                }
              }}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </form>

        {/* 3. Primary Desktop Actions: Shop | Shop by Goal | Wishlist | Cart (with badge) | Account menu */}
        <div className="navbar-right-cluster">
          <nav className="navbar-primary-nav" aria-label="Primary Navigation">
            <Link
              to="/products"
              className={`nav-text-link ${isActive('/products') ? 'active' : ''}`}
            >
              <Store size={15} />
              <span>Catalogue</span>
            </Link>

            <Link
              to="/smart-shop"
              className={`nav-text-link nav-ai-link ${isActive('/smart-shop') ? 'active' : ''}`}
            >
              <Sparkles size={15} />
              <span>{UI_STRINGS.shopByGoal}</span>
            </Link>
          </nav>

          <Link
            to="/wishlist"
            className={`nav-utility-link ${isActive('/wishlist') ? 'active' : ''}`}
            title="Saved Wishlist"
            aria-label={`Wishlist with ${wishlistCount} saved items`}
          >
            <Heart size={16} />
            <span className="nav-utility-label">Wishlist</span>
            {wishlistCount > 0 && <span className="nav-count-badge">{wishlistCount}</span>}
          </Link>

          <Link
            to="/cart"
            className={`nav-cart-pill ${isActive('/cart') ? 'active' : ''}`}
            aria-label={`Shopping cart with ${totalCount} items`}
          >
            <ShoppingCart size={16} />
            <span>Cart</span>
            <span className="nav-cart-badge">{totalCount}</span>
            {totalCount > 0 && (
              <span className="nav-cart-amount">₹{finalTotal.toLocaleString('en-IN')}</span>
            )}
          </Link>

          {/* Account Menu Dropdown */}
          <div className="navbar-account-dropdown-wrap" ref={dropdownRef}>
            <button
              type="button"
              className={`nav-utility-link account-menu-trigger ${accountDropdownOpen ? 'active' : ''}`}
              onClick={() => setAccountDropdownOpen((prev) => !prev)}
              aria-expanded={accountDropdownOpen}
              aria-haspopup="menu"
              aria-label="Account menu"
            >
              <User size={16} />
              <span className="nav-utility-label">Account</span>
              <ChevronDown size={14} />
            </button>

            {accountDropdownOpen && (
              <div className="account-dropdown-menu" role="menu">
                <Link
                  to="/orders"
                  role="menuitem"
                  className="account-dropdown-item"
                  onClick={() => setAccountDropdownOpen(false)}
                >
                  <Package size={15} />
                  <span>My Orders</span>
                </Link>

                <Link
                  to="/home#account"
                  role="menuitem"
                  className="account-dropdown-item"
                  onClick={() => setAccountDropdownOpen(false)}
                >
                  <User size={15} />
                  <span>Account Profile</span>
                </Link>

                {onOpenTour && (
                  <button
                    type="button"
                    role="menuitem"
                    className="account-dropdown-item"
                    onClick={() => {
                      setAccountDropdownOpen(false);
                      onOpenTour();
                    }}
                  >
                    <HelpCircle size={15} />
                    <span>3-Step Feature Tour</span>
                  </button>
                )}

                <div className="account-dropdown-divider" />

                {hasToken ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="account-dropdown-item danger"
                    onClick={handleLogout}
                  >
                    <LogOut size={15} />
                    <span>Sign Out</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      className="account-dropdown-item highlight"
                      onClick={handleTryDemoAccount}
                      disabled={demoLoading}
                    >
                      <Sparkles size={15} />
                      <span>{demoLoading ? 'Signing in...' : UI_STRINGS.tryDemoAccount}</span>
                    </button>
                    <Link
                      to="/login"
                      role="menuitem"
                      className="account-dropdown-item"
                      onClick={() => setAccountDropdownOpen(false)}
                    >
                      <LogIn size={15} />
                      <span>Sign In</span>
                    </Link>
                    <Link
                      to="/register"
                      role="menuitem"
                      className="account-dropdown-item"
                      onClick={() => setAccountDropdownOpen(false)}
                    >
                      <UserPlus size={15} />
                      <span>Create Account</span>
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Mobile Hamburger Menu Button */}
          <button
            type="button"
            className="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Responsive Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="mobile-nav-drawer">
          <Link to="/home" className={`mobile-nav-item ${isActive('/home') ? 'active' : ''}`}>
            <span>Home</span>
          </Link>
          <Link to="/products" className={`mobile-nav-item ${isActive('/products') ? 'active' : ''}`}>
            <Store size={17} />
            <span>Shop Catalogue</span>
          </Link>
          <Link
            to="/smart-shop"
            className={`mobile-nav-item ai-item ${isActive('/smart-shop') ? 'active' : ''}`}
          >
            <Sparkles size={17} />
            <span>{UI_STRINGS.shopByGoal}</span>
          </Link>
          <Link to="/wishlist" className={`mobile-nav-item ${isActive('/wishlist') ? 'active' : ''}`}>
            <Heart size={17} />
            <span>Wishlist ({wishlistCount})</span>
          </Link>
          <Link to="/cart" className={`mobile-nav-item ${isActive('/cart') ? 'active' : ''}`}>
            <ShoppingCart size={17} />
            <span>
              Cart ({totalCount} {totalCount === 1 ? 'item' : 'items'} · ₹
              {finalTotal.toLocaleString('en-IN')})
            </span>
          </Link>
          <Link to="/orders" className={`mobile-nav-item ${isActive('/orders') ? 'active' : ''}`}>
            <Package size={17} />
            <span>My Orders</span>
          </Link>
          {onOpenTour && (
            <button
              type="button"
              className="mobile-nav-item"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenTour();
              }}
            >
              <HelpCircle size={17} />
              <span>3-Step Feature Tour</span>
            </button>
          )}
          {hasToken ? (
            <>
              <Link to="/home#account" className="mobile-nav-item">
                <User size={17} />
                <span>Account Profile</span>
              </Link>
              <button type="button" className="mobile-nav-item logout-item" onClick={handleLogout}>
                <LogOut size={17} />
                <span>Sign Out</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="mobile-nav-item ai-item"
                onClick={handleTryDemoAccount}
                disabled={demoLoading}
              >
                <Sparkles size={17} />
                <span>{demoLoading ? 'Signing in...' : UI_STRINGS.tryDemoAccount}</span>
              </button>
              <Link to="/login" className="mobile-nav-item">
                <LogIn size={17} />
                <span>Sign In</span>
              </Link>
              <Link to="/register" className="mobile-nav-item">
                <UserPlus size={17} />
                <span>Create Account</span>
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}

export default Navbar;
