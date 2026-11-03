import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { wishlistApi } from '../services/api';
import WishlistCard from '../components/WishlistCard';

const Wishlist = () => {
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchWishlist();
  }, []);

  const fetchWishlist = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await wishlistApi.get('/');
      setWishlist(response.data.wishlist || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to load wishlist.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (productId) => {
    try {
      await wishlistApi.delete(`/${productId}`);
      setWishlist(prev => prev.filter(item => item._id !== productId));
      
      window.dispatchEvent(new Event('wishlistUpdated'));
    } catch {
      setError('Unable to remove product from wishlist. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="products-container" style={{ textAlign: 'center', marginTop: '3rem' }}>
        <h2>Loading your wishlist...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="products-container" style={{ textAlign: 'center', marginTop: '3rem' }}>
        <h2>Something went wrong.</h2>
        <p style={{ margin: '1rem 0' }}>{error}</p>
        <button className="btn btn-primary" onClick={fetchWishlist}>Try Again</button>
      </div>
    );
  }

  if (wishlist.length === 0) {
    return (
      <div className="products-container" style={{ textAlign: 'center', marginTop: '3rem' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>❤️</div>
        <h2>Your wishlist is empty</h2>
        <p style={{ margin: '1rem 0', color: '#666' }}>
          Save products you love and<br />find them here later.
        </p>
        <Link to="/products" className="btn btn-primary" style={{ display: 'inline-block', marginTop: '1rem' }}>
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="products-container">
      <div className="products-header">
        <h2>My Wishlist</h2>
        <p>{wishlist.length} {wishlist.length === 1 ? 'product' : 'products'} saved</p>
      </div>

      <div className="products-grid">
        {wishlist.map(product => (
          <WishlistCard 
            key={product._id} 
            product={product} 
            onRemove={handleRemove} 
          />
        ))}
      </div>
    </div>
  );
};

export default Wishlist;
  