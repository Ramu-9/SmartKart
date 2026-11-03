const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('./jwtConfig');

const generateToken = (userId) => {
  const secret = getJwtSecret();
  return jwt.sign({ id: userId }, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

module.exports = generateToken;