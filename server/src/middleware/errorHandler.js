const config = require('../config');

const notFoundHandler = (req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong';
  let details = err.details;

  if (err.name === 'ValidationError' && err.errors) {
    status = 400;
    details = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]));
    message = Object.values(details)[0] || 'Validation failed';
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid value for ${err.path}`;
  } else if (err.code === 11000) {
    status = 409;
    message = 'Duplicate value - that record already exists';
  } else if (err.name === 'MulterError') {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Proof image must be 2MB or smaller' : `Upload error: ${err.message}`;
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON body';
  } else if (err.name === 'MongoServerSelectionError' || err.name === 'MongooseServerSelectionError') {
    status = 503;
    message = 'Database is unavailable, please try again shortly';
  } else if (!err.isAppError && !err.status) {
    status = 500;
  }

  if (status >= 500) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);
    if (config.isProd) message = 'Internal server error';
  }
  const body = { error: message };
  if (details) body.details = details;
  if (err.code === 'SUBSCRIPTION_REQUIRED') body.code = err.code;
  res.status(status).json(body);
}

module.exports = { errorHandler, notFoundHandler };
