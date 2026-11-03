export const FALLBACK_PRODUCT_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
      <rect width="600" height="600" fill="#F1F5F9"/>
      <rect x="170" y="170" width="260" height="260" rx="28" fill="#E2E8F0" stroke="#CBD5E1" stroke-width="4"/>
      <path d="M235 320 L280 270 L325 315 L355 285 L385 320" fill="none" stroke="#64748B" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="265" cy="240" r="16" fill="#64748B"/>
      <text x="300" y="385" text-anchor="middle" font-family="Inter, sans-serif" font-size="22" font-weight="600" fill="#475569">SmartKart Studio</text>
    </svg>
  `);

export const handleImageError = (e) => {
  if (e?.currentTarget && e.currentTarget.src !== FALLBACK_PRODUCT_IMAGE) {
    e.currentTarget.src = FALLBACK_PRODUCT_IMAGE;
  }
};
