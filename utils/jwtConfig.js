const crypto = require('crypto');

const INSECURE_PLACEHOLDERS = new Set([
  'smartkart_jwt_secret_dev_key_2026',
  'your_jwt_secret_key',
  'jwt_secret_placeholder',
  'changeme',
  'secret'
]);

let ephemeralDevSecret = null;

function getJwtSecret() {
  const configured = typeof process.env.JWT_SECRET === 'string' ? process.env.JWT_SECRET.trim() : '';
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd) {
    if (!configured || configured.length < 16 || INSECURE_PLACEHOLDERS.has(configured)) {
      throw new Error(
        'FATAL: A strong JWT_SECRET (minimum 16 characters, non-placeholder) must be configured in production.'
      );
    }
    return configured;
  }

  if (configured && !INSECURE_PLACEHOLDERS.has(configured)) {
    return configured;
  }

  if (!ephemeralDevSecret) {
    ephemeralDevSecret = crypto.randomBytes(32).toString('hex');
  }
  return ephemeralDevSecret;
}

function validateJwtConfigOnStartup() {
  return Boolean(getJwtSecret());
}

module.exports = {
  getJwtSecret,
  validateJwtConfigOnStartup,
  INSECURE_PLACEHOLDERS
};
