class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
    this.isAppError = true;
  }
}
const bad = (m, d) => new AppError(400, m, d);
const notFound = (m = 'Not found') => new AppError(404, m);
const conflict = (m) => new AppError(409, m);
const forbidden = (m = 'Forbidden') => new AppError(403, m);
const unauthorized = (m = 'Authentication required') => new AppError(401, m);

module.exports = { AppError, bad, notFound, conflict, forbidden, unauthorized };
