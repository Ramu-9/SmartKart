const jwt = require('jsonwebtoken');
const Customer = require('../models/customer.model');

exports.authenticate = async (req, res, next) => {
  try {
    let token = req.cookies && req.cookies.token;
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const customer = await Customer.findById(decoded.id).select('-password');
    if (!customer) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    req.user = customer;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};