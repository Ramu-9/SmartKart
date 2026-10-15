import { Link } from 'react-router-dom';

const WishlistCard = ({ product, onRemove }) => {
  return (
    <div className="product-card wishlist-card">
      <div className="product-image-wrapper">
        <img src={product.image} alt={product.name} className="product-image" />
      </div>
      <div className="product-info">
        <h3 className="product-name">{product.name}</h3>
        <p className="product-category">{product.category}</p>
        <p className="product-price">₹{product.price.toLocaleString('en-IN')}</p>
        <p className="product-stock">
          {product.stock > 0 ? `${product.stock} units left` : 'Out of stock'}
        </p>
        <div className="wishlist-actions" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
          <Link to={`/products/${product._id}`} className="view-details-btn" style={{ textAlign: 'center' }}>
            View Details
          </Link>
          <button onClick={() => onRemove(product._id)} className="btn btn-outline" style={{ width: '100%', borderColor: 'var(--error-color)', color: 'var(--error-color)' }}>
            Remove ♥
          </button>
        </div>
      </div>
    </div>
  );
};

export default WishlistCard;
