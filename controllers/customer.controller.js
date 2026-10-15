const Customer = require('../models/customer.model');
const bcrypt = require('bcrypt');
const generateToken = require('../utils/generateToken');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax'
};

exports.register = async (req, res) => {
  try {
    const { fullName, email, password, phone } = req.body || {};

    if (!fullName || !email || !password || !phone) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (await Customer.findOne({ email: normalizedEmail })) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const customer = await Customer.create({
      fullName,
      email: normalizedEmail,
      password: hashedPassword,
      phone
    });

    res.status(201).json({
      success: true,
      message: 'Customer registered successfully',
      customer: {
        _id: customer._id,
        fullName: customer.fullName,
        email: customer.email,
        phone: customer.phone
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Email already registered' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const customer = await Customer.findOne({ email: normalizedEmail });
    if (!customer || !(await bcrypt.compare(password, customer.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(customer._id);

    res.cookie('token', token, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      message: 'Login successful'
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getMe = (req, res) => {
  const { _id, fullName, email, phone } = req.user;
  res.json({ _id, fullName, email, phone });
};

exports.logout = (req, res) => {
  res.clearCookie('token', COOKIE_OPTIONS);
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
};