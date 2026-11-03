import axios from 'axios';

export const TOKEN_STORAGE_KEY = 'smartkart_auth_token';

export const getAuthToken = () => {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const setAuthToken = (token) => {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    }
  } catch {
    // Ignore storage errors
  }
};

export const clearAuthToken = () => {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
};

const attachAuthInterceptor = (instance) => {
  instance.interceptors.request.use((config) => {
    const token = getAuthToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
  return instance;
};

export const customerApi = attachAuthInterceptor(
  axios.create({
    baseURL: '/customers',
    withCredentials: true,
  })
);

export const productApi = attachAuthInterceptor(
  axios.create({
    baseURL: '/products',
  })
);

export const wishlistApi = attachAuthInterceptor(
  axios.create({
    baseURL: '/wishlist',
    withCredentials: true,
  })
);

export const cartApi = attachAuthInterceptor(
  axios.create({
    baseURL: '/cart',
    withCredentials: true,
  })
);

export const orderApi = attachAuthInterceptor(
  axios.create({
    baseURL: '/orders',
    withCredentials: true,
  })
);

export const reviewApi = attachAuthInterceptor(
  axios.create({
    baseURL: '/reviews',
    withCredentials: true,
  })
);

export const aiApi = attachAuthInterceptor(
  axios.create({
    baseURL: '/api/ai',
    withCredentials: true,
  })
);

export default customerApi;
