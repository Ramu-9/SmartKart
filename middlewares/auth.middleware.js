const jwt = require('jsonwebtoken');
const Customer = require('../models/customer.model');
const inMemoryStore = require('../inMemoryStore');
const { getJwtSecret } = require('../utils/jwtConfig');
const { isMongoStorage } = require('../config/storageMode');

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
    customer = await Customer.findById(decoded.id).select('-password');
  } else {
    customer = inMemoryStore.getCustomerById(decoded.id);
  }
  return customer || null;
}

exports.authenticate = async (req, res, next) => {
  try {
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
    return res.status(401).json({ message: 'Invalid token' });
  }
};

exports.optionalAuthenticate = async (req, res, next) => {
  try {
    const customer = await resolveUserFromRequest(req);
    if (customer) {
      req.user = customer;
    }
  } catch (_err) {
    // Proceed as guest
  }
  next();
};