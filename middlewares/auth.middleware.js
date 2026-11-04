const jwt = require('jsonwebtoken');
const Customer = require('../models/customer.model');
const inMemoryStore = require('../inMemoryStore');
const { getJwtSecret } = require('../utils/jwtConfig');
const {
  isMongoStorage,
  assertMongoAvailable,
  isDatabaseUnavailableError
} = require('../config/storageMode');

async function resolveUserFromRequest(req) {
  let token = req.cookies && req.cookies.token;
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return null;

  const secret = getJwtSecret();
  const decoded = jwt.verify(token, secret);

  let customer = null;
  if (isMongoStorage()) {
    assertMongoAvailable();
    customer = await Customer.findById(decoded.id).select('-password');
  } else {
    customer = inMemoryStore.getCustomerById(decoded.id);
  }
  return customer || null;
}

exports.authenticate = async (req, res, next) => {
  try {
    if (isMongoStorage()) {
      assertMongoAvailable();
    }
    let token = req.cookies && req.cookies.token;
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const customer = await resolveUserFromRequest(req);
    if (!customer) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    req.user = customer;
    next();
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return res.status(503).json({
        success: false,
        message: 'Service temporarily unavailable (database offline)',
        error: 'Service temporarily unavailable (database offline)'
      });
    }
    return res.status(401).json({ message: 'Invalid token' });
  }
};

exports.optionalAuthenticate = async (req, res, next) => {
  try {
    if (isMongoStorage()) {
      assertMongoAvailable();
    }
    const customer = await resolveUserFromRequest(req);
    if (customer) {
      req.user = customer;
    }
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return res.status(503).json({
        success: false,
        message: 'Service temporarily unavailable (database offline)',
        error: 'Service temporarily unavailable (database offline)'
      });
    }
    // Proceed as guest for invalid/expired token
  }
  next();
};