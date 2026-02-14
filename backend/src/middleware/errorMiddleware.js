const notFound = (req, res, _next) => {
  res.status(404);
  throw new Error(`Route not found: ${req.originalUrl}`);
};

const errorHandler = (err, _req, res, _next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
};

module.exports = {
  notFound,
  errorHandler
};
