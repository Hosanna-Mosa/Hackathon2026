const User = require('../models/User');
const { verifyAuthToken } = require('../utils/authToken');

const extractBearerToken = (authorizationHeader) => {
  const value = String(authorizationHeader || '').trim();
  if (!value.toLowerCase().startsWith('bearer ')) {
    return '';
  }
  return value.slice(7).trim();
};

const protect = async (req, res, next) => {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authorization token is required.'
      });
    }

    const decoded = verifyAuthToken(token);
    const userId = String(decoded?.userId || '').trim();
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authorization token.'
      });
    }

    const user = await User.findById(userId).select('_id name email');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User for this token no longer exists.'
      });
    }

    req.user = user;
    req.userId = String(user._id);
    return next();
  } catch (_error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authorization token.'
    });
  }
};

module.exports = {
  protect
};
