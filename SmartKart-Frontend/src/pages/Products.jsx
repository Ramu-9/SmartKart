import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Search,
  SlidersHorizontal,
  Sparkles,
  RotateCcw,
  X,
  Star,
  AlertCircle
} from 'lucide-react';
import { productApi, wishlistApi } from '../services/api';
import ProductCard from '../components/ProductCard';
import UI_STRINGS from '../constants/uiStrings';

const CATEGORIES = [
  'All Categories',
  'Electronics',
  'Furniture',
  'Home',
  'Study',
  'Fashion',
  'Books'
];

const PRICE_RANGES = [
  { id: 'all', label: 'Any Price' },
  { id: 'under_1500', label: 'Under ₹1,500', max: 1500 },
  { id: '1500_5000', label: '₹1,500 – ₹5,000', min: 1500, max: 5000 },
  { id: '5000_15000', label: '₹5,000 – ₹15,000', min: 5000, max: 15000 },
  { id: 'above_15000', label: 'Above ₹15,000', min: 15000 }
];

const RATING_FILTERS = [
  { id: 0, label: 'Any Rating' },
  { id: 4, label: '4★ & above (Genuine)' },
  { id: 3, label: '3★ & above (Genuine)' }
];

const Products = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory = searchParams.get('category') || 'All Categories';
  const initialSearch = searchParams.get('search') || '';

  const [products, setProducts] = useState([]);
  const [wishlistIds, setWishlistIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [category, setCategory] = useState(
    CATEGORIES.includes(initialCategory) ? initialCategory : 'All Categories'
  );
  const [priceRange, setPriceRange] = useState('all');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState('');
  const [mobileFilterSheetOpen, setMobileFilterSheetOpen] = useState(false);

  useEffect(() => {
    const paramCat = searchParams.get('category');
    const paramSearch = searchParams.get('search');
    if (paramCat && CATEGORIES.includes(paramCat)) {
      setCategory(paramCat);
    } else if (!paramCat) {
      setCategory('All Categories');
    }
    if (paramSearch !== null) {
      setSearchTerm(paramSearch);
    }
  }, [searchParams]);

  const fetchProductsAndWishlist = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (category && category !== 'All Categories') params.category = category;
      if (sort === 'price_asc' || sort === 'price_desc' || sort === 'rating_desc') {
        params.sort = sort;
      }

      const [productsRes, wishlistRes] = await Promise.allSettled([
        productApi.get('', { params }),
        wishlistApi.get('/')
      ]);

      if (productsRes.status === 'fulfilled') {
        setProducts(productsRes.value.data.products || []);
      } else {
        throw productsRes.reason;
      }

      if (wishlistRes.status === 'fulfilled') {
        const ids = (wishlistRes.value.data.wishlist || []).map((item) => item._id);
        setWishlistIds(ids);
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Unable to load catalogue products right now.'
      );
    } finally {
      setLoading(false);
    }
  }, [searchTerm, category, sort]);

  useEffect(() => {
    fetchProductsAndWishlist();
  }, [fetchProductsAndWishlist]);

  const handleCategoryChange = (newCat) => {
    setCategory(newCat);
    const nextParams = new URLSearchParams(searchParams);
    if (newCat === 'All Categories') {
      nextParams.delete('category');
    } else {
      nextParams.set('category', newCat);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const handleSearchChange = (val) => {
    setSearchTerm(val);
    const nextParams = new URLSearchParams(searchParams);
    if (!val.trim()) {
      nextParams.delete('search');
    } else {
      nextParams.set('search', val);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setCategory('All Categories');
    setPriceRange('all');
    setInStockOnly(false);
    setMinRating(0);
    setSort('');
    setSearchParams({}, { replace: true });
  };

  const handleWishlistToggle = (productId, isAdded) => {
    if (isAdded) {
      setWishlistIds((prev) => [...prev, productId]);
    } else {
      setWishlistIds((prev) => prev.filter((id) => id !== productId));
    }
  };

  const displayedProducts = useMemo(() => {
    let list = [...products];

    const rangeObj = PRICE_RANGES.find((r) => r.id === priceRange);
    if (rangeObj) {
      if (rangeObj.min !== undefined) {
        list = list.filter((p) => p.price >= rangeObj.min);
      }
      if (rangeObj.max !== undefined) {
        list = list.filter((p) => p.price <= rangeObj.max);
      }
    }

    if (inStockOnly) {
      list = list.filter((p) => (p.stock || 0) > 0);
    }

    if (minRating > 0) {
      list = list.filter((p) => Number(p.genuineRating || 0) >= minRating);
    }

    if (sort === 'name_asc') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === 'rating_desc') {
      list.sort((a, b) => (b.genuineRating || 0) - (a.genuineRating || 0));
    }

    return list;
  }, [products, priceRange, inStockOnly, minRating, sort]);

  // Build removable active filter chips
  const activeFilterChips = useMemo(() => {
    const chips = [];
    if (searchTerm.trim()) {
      chips.push({
        key: 'search',
        label: `Search: "${searchTerm.trim()}"`,
        onRemove: () => handleSearchChange('')
      });
    }
    if (category !== 'All Categories') {
      chips.push({
        key: 'category',
        label: `Category: ${category}`,
        onRemove: () => handleCategoryChange('All Categories')
      });
    }
    if (priceRange !== 'all') {
      const found = PRICE_RANGES.find((r) => r.id === priceRange);
      if (found) {
        chips.push({
          key: 'price',
          label: `Price: ${found.label}`,
          onRemove: () => setPriceRange('all')
        });
      }
    }
    if (inStockOnly) {
      chips.push({
        key: 'stock',
        label: 'In Stock Only',
        onRemove: () => setInStockOnly(false)
      });
    }
    if (minRating > 0) {
      chips.push({
        key: 'rating',
        label: `${minRating}★ & above`,
        onRemove: () => setMinRating(0)
      });
    }
    return chips;
  }, [searchTerm, category, priceRange, inStockOnly, minRating]);

  const renderFilterControls = () => (
    <div className="sidebar-filters-stack">
      <div className="sidebar-filter-section">
        <h4 className="sidebar-filter-heading">Category</h4>
        <div className="sidebar-radio-list">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`sidebar-filter-item ${category === cat ? 'active' : ''}`}
              onClick={() => handleCategoryChange(cat)}
            >
              <span>{cat}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar-filter-section">
        <h4 className="sidebar-filter-heading">Price Range</h4>
        <div className="sidebar-radio-list">
          {PRICE_RANGES.map((range) => (
            <button
              key={range.id}
              type="button"
              className={`sidebar-filter-item ${priceRange === range.id ? 'active' : ''}`}
              onClick={() => setPriceRange(range.id)}
            >
              <span>{range.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar-filter-section">
        <h4 className="sidebar-filter-heading">Availability</h4>
        <label className="sidebar-checkbox-row">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
          />
          <span>In Stock Only</span>
        </label>
      </div>

      <div className="sidebar-filter-section">
        <h4 className="sidebar-filter-heading">Customer Rating</h4>
        <div className="sidebar-radio-list">
          {RATING_FILTERS.map((rf) => (
            <button
              key={rf.id}
              type="button"
              className={`sidebar-filter-item ${minRating === rf.id ? 'active' : ''}`}
              onClick={() => setMinRating(rf.id)}
            >
              <Star size={13} fill={rf.id > 0 ? '#D97706' : 'none'} color={rf.id > 0 ? '#D97706' : 'currentColor'} />
              <span>{rf.label}</span>
            </button>
          ))}
        </div>
      </div>

      {activeFilterChips.length > 0 && (
        <button
          type="button"
          className="btn btn-outline sidebar-reset-btn"
          onClick={handleResetFilters}
        >
          <RotateCcw size={14} />
          <span>Reset All Filters</span>
        </button>
      )}
    </div>
  );

  return (
    <div className="products-container">
      {/* Top Header */}
      <div className="catalog-top-banner">
        <div>
          <span className="section-eyebrow">SmartKart Catalogue</span>
          <h2>All Products</h2>
          <p className="catalog-subtitle">
            Showing <strong>{displayedProducts.length}</strong> of {products.length || 38} products
          </p>
        </div>

        <div className="catalog-ai-bridge">
          <div>
            <strong>Shopping for a complete room or setup?</strong>
            <p>Describe your goal and budget to get a ready-to-edit bundle.</p>
          </div>
          <Link
            to={
              category !== 'All Categories'
                ? `/smart-shop?q=${encodeURIComponent(
                    `Recommend the best ${category.toLowerCase()} products for my setup`
                  )}`
                : '/smart-shop'
            }
            className="btn btn-ai btn-inline"
          >
            <Sparkles size={15} />
            <span>{UI_STRINGS.shopByGoal}</span>
          </Link>
        </div>
      </div>

      {/* Main 2-Column Layout: Left Sidebar Filters + Right Product Grid */}
      <div className="catalog-main-layout">
        {/* Desktop Left Sidebar */}
        <aside className="catalog-sidebar-desktop" aria-label="Product Filters">
          <div className="catalog-sidebar-card">
            <div className="catalog-sidebar-header">
              <SlidersHorizontal size={16} />
              <h3>Filters</h3>
            </div>
            {renderFilterControls()}
          </div>
        </aside>

        {/* Right Main Column */}
        <div className="catalog-content-column">
          {/* Top Bar: Search + Mobile Filter Trigger + Sort Dropdown at Top Right */}
          <div className="catalog-top-controls-row">
            <div className="catalog-search-box">
              <Search size={16} className="catalog-search-icon" />
              <input
                type="search"
                placeholder="Filter by name, brand, or keyword..."
                aria-label="Search products"
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="search-input with-icon"
              />
            </div>

            <div className="catalog-sort-and-mobile-btn">
              <button
                type="button"
                className="btn btn-outline mobile-filter-sheet-trigger"
                onClick={() => setMobileFilterSheetOpen(true)}
              >
                <SlidersHorizontal size={15} />
                <span>Filters {activeFilterChips.length > 0 ? `(${activeFilterChips.length})` : ''}</span>
              </button>

              <div className="sort-dropdown-wrap">
                <label htmlFor="catalog-sort-select" className="sort-label">
                  Sort by:
                </label>
                <select
                  id="catalog-sort-select"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  aria-label="Sort products"
                  className="sort-select"
                >
                  <option value="">Featured</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="rating_desc">Customer Rating: High to Low</option>
                  <option value="name_asc">Name: A to Z</option>
                </select>
              </div>
            </div>
          </div>

          {/* Active Filter Removable Chips */}
          {activeFilterChips.length > 0 && (
            <div className="active-filters-bar" aria-label="Active filters">
              {activeFilterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className="active-filter-chip"
                  onClick={chip.onRemove}
                  aria-label={`Remove filter ${chip.label}`}
                >
                  <span>{chip.label}</span>
                  <X size={13} />
                </button>
              ))}
              <button
                type="button"
                className="clear-all-chips-btn"
                onClick={handleResetFilters}
              >
                Clear all
              </button>
            </div>
          )}

          {/* Loading Skeletons */}
          {loading && (
            <div className="products-grid" aria-busy="true" aria-label="Loading catalogue">
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
          )}

          {/* Meaningful Error State with Retry */}
          {!loading && error && (
            <div className="error-state">
              <AlertCircle size={32} style={{ margin: '0 auto 0.75rem', color: 'var(--error-color)' }} />
              <h3>Could not load products</h3>
              <p style={{ margin: '0.5rem 0 1.25rem' }}>{error}</p>
              <button
                type="button"
                className="btn btn-primary btn-inline"
                onClick={fetchProductsAndWishlist}
              >
                <RotateCcw size={15} />
                <span>Retry</span>
              </button>
            </div>
          )}

          {/* Clear "No results" Empty State */}
          {!loading && !error && displayedProducts.length === 0 && (
            <div className="empty-state">
              <h3>No results match your current filters</h3>
              <p style={{ marginTop: '0.5rem', marginBottom: '1.25rem', color: 'var(--text-muted)' }}>
                Try removing one of the active filter chips above, widening your price range, or describing what you need in {UI_STRINGS.shopByGoal}.
              </p>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '0.75rem',
                  flexWrap: 'wrap'
                }}
              >
                <button
                  type="button"
                  className="btn btn-primary btn-inline"
                  onClick={handleResetFilters}
                >
                  <RotateCcw size={15} />
                  <span>Reset All Filters</span>
                </button>
                <Link to="/smart-shop" className="btn btn-ai btn-inline">
                  <Sparkles size={15} />
                  <span>{UI_STRINGS.shopByGoal}</span>
                </Link>
              </div>
            </div>
          )}

          {/* Product Cards Grid */}
          {!loading && !error && displayedProducts.length > 0 && (
            <div className="products-grid">
              {displayedProducts.map((product) => (
                <ProductCard
                  key={product._id}
                  product={product}
                  isWishlisted={wishlistIds.includes(product._id)}
                  onWishlistToggle={handleWishlistToggle}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Bottom Sheet for Filters */}
      {mobileFilterSheetOpen && (
        <div
          className="mobile-filter-sheet-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Filter products"
        >
          <div className="mobile-filter-sheet">
            <div className="mobile-filter-sheet-header">
              <h3>Filter Products</h3>
              <button
                type="button"
                className="mobile-sheet-close"
                onClick={() => setMobileFilterSheetOpen(false)}
                aria-label="Close filters"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mobile-filter-sheet-body">{renderFilterControls()}</div>
            <div className="mobile-filter-sheet-footer">
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={() => setMobileFilterSheetOpen(false)}
              >
                Show {displayedProducts.length} Results
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
