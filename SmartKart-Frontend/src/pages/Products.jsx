import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { productApi, wishlistApi } from '../services/api';
import ProductCard from '../components/ProductCard';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [wishlistIds, setWishlistIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState('All Categories');
  const [sort, setSort] = useState('');

  const categories = ['All Categories', 'Electronics', 'Fashion', 'Books', 'Home'];

  useEffect(() => {
    fetchProductsAndWishlist();
  }, [searchTerm, category, sort]);

  const fetchProductsAndWishlist = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (category && category !== 'All Categories') params.category = category;
      if (sort) params.sort = sort;
      
      const [productsRes, wishlistRes] = await Promise.all([
        productApi.get('', { params }),
        wishlistApi.get('/')
      ]);

      setProducts(productsRes.data.products || []);
      
      const ids = wishlistRes.data.wishlist.map(item => item._id);
      setWishlistIds(ids);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Something went wrong while loading products.');
    } finally {
      setLoading(false);
    }
  };

  const handleWishlistToggle = (productId, isAdded) => {
    if (isAdded) {
      setWishlistIds(prev => [...prev, productId]);
    } else {
      setWishlistIds(prev => prev.filter(id => id !== productId));
    }
  };

  return (
    <div className="products-container">
      <div className="products-header">
        <h2>SmartKart Catalog</h2>
        <div className="filters">
          <input 
            type="text" 
            placeholder="Search products..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <select 
            value={category} 
            onChange={(e) => setCategory(e.target.value)}
            className="category-select"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select 
            value={sort} 
            onChange={(e) => setSort(e.target.value)}
            className="sort-select"
          >
            <option value="">Sort By</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
        </div>
      </div>

      {loading && <div className="loading-state">Loading products...</div>}
      {error && <div className="error-state">{error}</div>}
      
      {!loading && !error && products.length === 0 && (
        <div className="empty-state">No products found.</div>
      )}

      {!loading && !error && products.length > 0 && (
        <div className="products-grid">
          {products.map(product => (
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
  );
};

export default Products;
