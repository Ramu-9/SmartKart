import axios from 'axios';

export const customerApi = axios.create({
  baseURL: '/customers',
  withCredentials: true,
});

export const productApi = axios.create({
  baseURL: '/products',
});

export const wishlistApi = axios.create({
  baseURL: '/wishlist',
  withCredentials: true,
});

export const cartApi = axios.create({
  baseURL: '/cart',
  withCredentials: true,
});

export const orderApi = axios.create({
  baseURL: '/orders',
  withCredentials: true,
});

export default customerApi;
