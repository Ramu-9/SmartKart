import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { ToastProvider } from './context/ToastContext';
import Navbar from './components/Navbar';
import OnboardingTour from './components/OnboardingTour';
import Register from './pages/Register';
import Login from './pages/Login';
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetails from './pages/ProductDetails';
import SmartShop from './pages/SmartShop';
import Wishlist from './pages/Wishlist';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Orders from './pages/Orders';
import OrderDetails from './pages/OrderDetails';
import OrderSuccess from './pages/OrderSuccess';
import './App.css';

function App() {
  const [tourForceOpen, setTourForceOpen] = useState(false);

  return (
    <ToastProvider>
      <CartProvider>
        <div className="app-container">
          <Navbar onOpenTour={() => setTourForceOpen(true)} />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route path="/register" element={<Register />} />
              <Route path="/login" element={<Login />} />
              <Route path="/home" element={<Home />} />
              <Route path="/products" element={<Products />} />
              <Route path="/products/:id" element={<ProductDetails />} />
              <Route path="/smart-shop" element={<SmartShop />} />
              <Route path="/wishlist" element={<Wishlist />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/orders/:id" element={<OrderDetails />} />
              <Route path="/order-success/:id" element={<OrderSuccess />} />
            </Routes>
          </main>
          <OnboardingTour
            forceOpen={tourForceOpen}
            onCloseExternal={() => setTourForceOpen(false)}
          />
        </div>
      </CartProvider>
    </ToastProvider>
  );
}

export default App;
