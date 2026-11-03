import { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  User,
  Mail,
  Phone,
  Sparkles,
  ArrowRight,
  ShoppingBag,
  Package,
  Heart,
  CheckCircle2,
  LogIn,
  Search
} from 'lucide-react';
import api, { productApi, wishlistApi, setAuthToken } from '../services/api';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import ProductCard from '../components/ProductCard';
import UI_STRINGS from '../constants/uiStrings';

const CATEGORY_DESCRIPTIONS = {
  Electronics: 'Headphones, mechanical keyboards, 4K monitors, mice & power accessories',
  Furniture: 'Ergonomic chairs, study desks, bookshelves & footrests',
  Home: 'Smart desk lighting, electric kettles, surge protectors & room organizers',
  Study: 'Ruled notebook sets, scientific calculators, desk mats & stationery kits',
  Fashion: 'Laptop backpacks, blue-light glasses, hoodies & everyday footwear',
  Books: 'Software engineering classics, productivity & career books'
};

function Home() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { totalCount, fetchCart } = useCart();
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [wishlistIds, setWishlistIds] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [goalQuery, setGoalQuery] = useState('');
  const [activeCategoryTab, setActiveCategoryTab] = useState('All');
  const [demoSigningIn, setDemoSigningIn] = useState(false);

  useEffect(() => {
    const loadHomeData = async () => {
      setLoadingProducts(true);
      try {
        const [userRes, productsRes, wishlistRes] = await Promise.allSettled([
          api.get('/me'),
          productApi.get(''),
          wishlistApi.get('/')
        ]);

        if (userRes.status === 'fulfilled') {
          setUser(userRes.value.data);
        } else {
          setUser(null);
        }

        if (productsRes.status === 'fulfilled') {
          setProducts(productsRes.value.data.products || []);
        }

        if (wishlistRes.status === 'fulfilled') {
          setWishlistIds((wishlistRes.value.data.wishlist || []).map((item) => item._id));
        }
      } finally {
        setLoadingProducts(false);
      }
    };

    loadHomeData();
  }, []);

  const handleGoalSubmit = (e) => {
    e.preventDefault();
    const trimmed = goalQuery.trim();
    if (trimmed) {
      navigate(`/smart-shop?q=${encodeURIComponent(trimmed)}`);
    } else {
      navigate('/smart-shop');
    }
  };

  const handleQuickDemoLogin = async () => {
    setDemoSigningIn(true);
    try {
      const res = await api.post('/login', {
        email: 'demo@smartkart.com',
        password: 'password123'
      });
      if (res.data?.token) {
        setAuthToken(res.data.token);
      }
      const meRes = await api.get('/me');
      setUser(meRes.data);
      await fetchCart();
      showToast('Signed in with Demo Account', 'success');
    } catch {
      navigate('/login');
    } finally {
      setDemoSigningIn(false);
    }
  };

  const handleWishlistToggle = (productId, isAdded) => {
    if (isAdded) {
      setWishlistIds((prev) => [...prev, productId]);
    } else {
      setWishlistIds((prev) => prev.filter((id) => id !== productId));
    }
  };

  // Compute real category stats from actual catalogue products
  const categoryStats = useMemo(() => {
    const map = {};
    products.forEach((p) => {
      if (!map[p.category]) {
        map[p.category] = {
          name: p.category,
          count: 0,
          minPrice: p.price,
          inStockCount: 0
        };
      }
      map[p.category].count += 1;
      if (p.price < map[p.category].minPrice) {
        map[p.category].minPrice = p.price;
      }
      if (p.stock > 0) {
        map[p.category].inStockCount += 1;
      }
    });
    return Object.values(map);
  }, [products]);

  // Top-rated / featured products
  const topRatedProducts = useMemo(() => {
    const filtered =
      activeCategoryTab === 'All'
        ? [...products]
        : products.filter((p) => p.category === activeCategoryTab);

    filtered.sort((a, b) => {
      const rA = a.genuineRating || 0;
      const rB = b.genuineRating || 0;
      if (rB !== rA) return rB - rA;
      return b.stock - a.stock;
    });

    return filtered.slice(0, 6);
  }, [products, activeCategoryTab]);

  return (
    <div className="home-page-container">
      {/* 1. Hero Section: One big "Describe what you need" input + 4 example chips */}
      <section className="home-hero-centered-card">
        <div className="home-hero-inner">
          <span className="section-eyebrow">
            {UI_STRINGS.shopByGoal} · {products.length || 38} In-Stock Essentials
          </span>
          <h1 className="home-intelligence-title">{UI_STRINGS.homeHeroTitle}</h1>
          <p className="home-intelligence-desc">{UI_STRINGS.homeHeroSubtitle}</p>

          <form onSubmit={handleGoalSubmit} className="home-goal-search-bar">
            <div className="home-goal-input-wrap">
              <Search size={19} className="home-goal-search-icon" />
              <input
                type="text"
                className="home-mission-input"
                aria-label="Describe what you need"
                placeholder={UI_STRINGS.homePromptPlaceholder}
                value={goalQuery}
                onChange={(e) => setGoalQuery(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-ai home-generate-btn">
              <Sparkles size={17} />
              <span>{UI_STRINGS.shopByGoal}</span>
            </button>
          </form>

          {/* 4 Example Chips */}
          <div className="home-example-missions">
            <span className="templates-label">Popular goals:</span>
            <div className="templates-row">
              {UI_STRINGS.homeExampleChips.map((chipText) => (
                <button
                  key={chipText}
                  type="button"
                  className="template-action-btn"
                  onClick={() => navigate(`/smart-shop?q=${encodeURIComponent(chipText)}`)}
                >
                  {chipText}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 2. Shop by Category */}
      <section className="home-section-block">
        <div className="home-section-header">
          <div>
            <span className="section-eyebrow">Departments</span>
            <h2>Browse by Category</h2>
          </div>
          <Link to="/products" className="section-link-cta">
            <span>View all {products.length || 38} products</span>
            <ArrowRight size={16} />
          </Link>
        </div>

        <div className="home-categories-grid">
          {categoryStats.map((cat) => (
            <Link
              key={cat.name}
              to={`/products?category=${encodeURIComponent(cat.name)}`}
              className="home-category-card"
            >
              <div className="home-category-top">
                <h3>{cat.name}</h3>
                <span className="category-count-text">{cat.count} items</span>
              </div>
              <p className="home-category-desc">
                {CATEGORY_DESCRIPTIONS[cat.name] ||
                  `Curated ${cat.name.toLowerCase()} essentials in stock.`}
              </p>
              <div className="home-category-footer">
                <span className="category-starting-price">
                  From ₹{cat.minPrice.toLocaleString('en-IN')}
                </span>
                <span className="category-explore-arrow">Explore &rarr;</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 3. Top-Rated & Featured Products */}
      <section className="home-section-block">
        <div className="home-section-header">
          <div>
            <span className="section-eyebrow">Customer Favourites</span>
            <h2>Top-Rated &amp; Featured Products</h2>
          </div>

          <div
            className="home-category-pills-bar"
            role="tablist"
            aria-label="Filter top products by category"
          >
            {['All', 'Electronics', 'Furniture', 'Home', 'Study', 'Fashion', 'Books'].map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeCategoryTab === tab}
                className={`category-filter-pill ${activeCategoryTab === tab ? 'active' : ''}`}
                onClick={() => setActiveCategoryTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {loadingProducts ? (
          <div className="products-grid" aria-busy="true" aria-label="Loading products">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="product-skeleton-card">
                <div className="skeleton-box skeleton-img" />
                <div className="skeleton-body">
                  <div className="skeleton-box skeleton-line-sm" />
                  <div className="skeleton-box skeleton-line-lg" />
                  <div className="skeleton-box skeleton-line-md" />
                  <div className="skeleton-box skeleton-btn" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="products-grid">
              {topRatedProducts.map((product) => (
                <ProductCard
                  key={product._id}
                  product={product}
                  isWishlisted={wishlistIds.includes(product._id)}
                  onWishlistToggle={handleWishlistToggle}
                />
              ))}
            </div>

            <div className="home-catalog-More-bar">
              <Link to="/products" className="btn btn-outline btn-inline">
                <ShoppingBag size={16} />
                <span>Browse All {products.length} Products</span>
              </Link>
              <Link to="/smart-shop" className="btn btn-ai btn-inline">
                <Sparkles size={16} />
                <span>{UI_STRINGS.shopByGoal}</span>
              </Link>
            </div>
          </>
        )}
      </section>

      {/* 4. Customer Account Section (#account) */}
      <section id="account" className="home-account-section">
        {user ? (
          <>
            <div className="home-account-header">
              <div>
                <div className="account-verified-tag">
                  <CheckCircle2 size={14} />
                  <span>Signed In</span>
                </div>
                <h2>Your Account</h2>
              </div>
              <div className="home-account-actions">
                <Link to="/orders" className="btn btn-outline btn-inline">
                  <Package size={16} />
                  <span>My Orders</span>
                </Link>
                <Link to="/wishlist" className="btn btn-outline btn-inline">
                  <Heart size={16} />
                  <span>Wishlist ({wishlistIds.length})</span>
                </Link>
                <Link to="/cart" className="btn btn-primary btn-inline">
                  <ShoppingBag size={16} />
                  <span>Cart ({totalCount})</span>
                </Link>
              </div>
            </div>

            <div className="home-profile-strip">
              <div className="home-profile-cell">
                <div className="profile-icon">
                  <User size={20} />
                </div>
                <div>
                  <div className="profile-label">Customer Name</div>
                  <div className="profile-value">{user.fullName}</div>
                </div>
              </div>

              <div className="home-profile-cell">
                <div className="profile-icon">
                  <Mail size={20} />
                </div>
                <div>
                  <div className="profile-label">Email Address</div>
                  <div className="profile-value">{user.email}</div>
                </div>
              </div>

              <div className="home-profile-cell">
                <div className="profile-icon">
                  <Phone size={20} />
                </div>
                <div>
                  <div className="profile-label">Phone Number</div>
                  <div className="profile-value">{user.phone}</div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="home-guest-banner">
            <div>
              <span className="section-eyebrow">Customer Account</span>
              <h2>Sign in to save your cart, ask for discounts &amp; post verified reviews</h2>
              <p>
                Explore the full catalogue or build bundles in {UI_STRINGS.shopByGoal} right away.
                Want to test cart checkout and discounts immediately? Use our pre-configured demo account.
              </p>
            </div>
            <div className="home-account-actions">
              <button
                type="button"
                className="btn btn-ai btn-inline"
                onClick={handleQuickDemoLogin}
                disabled={demoSigningIn}
              >
                <Sparkles size={16} />
                <span>{demoSigningIn ? 'Signing In...' : UI_STRINGS.tryDemoAccount}</span>
              </button>
              <Link to="/login" className="btn btn-outline btn-inline">
                <LogIn size={16} />
                <span>Sign In / Register</span>
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default Home;
