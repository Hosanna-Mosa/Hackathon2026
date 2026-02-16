const bcrypt = require('bcryptjs');

const User = require('../models/User');
const { signAuthToken } = require('../utils/authToken');

const normalizeName = (value) => String(value || '').trim();
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = Number(process.env.AUTH_MIN_PASSWORD_LENGTH || 6);

const toAuthPayload = (user) => ({
  user: {
    id: String(user._id),
    name: user.name,
    email: user.email
  },
  token: signAuthToken(user._id)
});

const signup = async (req, res, next) => {
  try {
    const name = normalizeName(req.body?.name);
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'name, email, and password are required.'
      });
    }

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`
      });
    }

    const existing = await User.findOne({ email }).select('_id');
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name,
      email,
      passwordHash
    });

    return res.status(201).json({
      success: true,
      ...toAuthPayload(user)
    });
  } catch (error) {
    if (!res.headersSent && error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.'
      });
    }
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'email and password are required.'
      });
    }

    const user = await User.findOne({ email }).select('+passwordHash name email');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const validPassword = await bcrypt.compare(password, String(user.passwordHash || ''));
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    return res.status(200).json({
      success: true,
      ...toAuthPayload(user)
    });
  } catch (error) {
    return next(error);
  }
};

const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: {
      id: String(req.user._id),
      name: req.user.name,
      email: req.user.email
    }
  });
};

module.exports = {
  signup,
  login,
  getMe
};
