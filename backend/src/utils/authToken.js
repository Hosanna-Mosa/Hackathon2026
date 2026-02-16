const jwt = require('jsonwebtoken');

const resolveJwtSecret = () => {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is missing in environment variables.');
  }

  console.warn('[auth] JWT_SECRET is not set. Falling back to an unsafe dev secret.');
  return 'dev-only-insecure-secret';
};

const signAuthToken = (userId) => {
  const secret = resolveJwtSecret();
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign({ userId: String(userId) }, secret, { expiresIn });
};

const verifyAuthToken = (token) => {
  const secret = resolveJwtSecret();
  return jwt.verify(token, secret);
};

module.exports = {
  signAuthToken,
  verifyAuthToken
};
