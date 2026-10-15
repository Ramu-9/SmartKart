import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ShoppingCart, LogOut, Heart, Package } from 'lucide-react';
import api, { wishlistApi } from '../services/api';
import { useCart } from '../context/CartContext';

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [wishlistCount, setWishlistCount] = useState(0);
  const { totalCount, clearCart } = useCart();

  const fetchWishlistCount = async () => {
    try {
      const response = await wishlistApi.get('/');
      setWishlistCount(response.data.count || 0);
    } catch (error) {
      console.error('Failed to fetch wishlist count:', error);
    }
  };

  useEffect(() => {
    const showLogout = location.pathname === '/home' || 
                       location.pathname.startsWith('/products') || 
                       location.pathname.startsWith('/wishlist') ||
                       location.pathname.startsWith('/cart') ||
                       location.pathname.startsWith('/checkout') ||
                       location.pathname.startsWith('/orders') ||
                       location.pathname.startsWith('/order-success');
    if (showLogout) {
      fetchWishlistCount();
    }

    const handleWishlistUpdate = () => {
      fetchWishlistCount();
    };

    window.addEventListener('wishlistUpdated', handleWishlistUpdate);
    return () => {
      window.removeEventListener('wishlistUpdated', handleWishlistUpdate);
    };
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await api.post('/logout');
      clearCart();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      clearCart();
      navigate('/login');
    }
  };

  const showLogout = location.pathname === '/home' || 
                     location.pathname.startsWith('/products') || 
                     location.pathname.startsWith('/wishlist') ||
                     location.pathname.startsWith('/cart') ||
                     location.pathname.startsWith('/checkout') ||
                     location.pathname.startsWith('/orders') ||
                     location.pathname.startsWith('/order-success');

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <ShoppingCart size={24} color="var(--accent-color)" />
        SmartKart
      </Link>
      
      {showLogout && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link to="/products" className="btn btn-outline" style={{ border: 'none' }}>
            Products
          </Link>
          <Link to="/wishlist" className="btn btn-outline" style={{ border: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Heart size={18} />
            Wishlist ({wishlistCount})
          </Link>
          <Link to="/cart" className="btn btn-outline" style={{ border: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <ShoppingCart size={18} />
            Cart ({totalCount})
          </Link>
          <Link to="/orders" className="btn btn-outline" style={{ border: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Package size={18} />
            Orders
          </Link>
          <button className="btn btn-outline" onClick={handleLogout}>
            <LogOut size={18} />
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}

export default Navbar;
