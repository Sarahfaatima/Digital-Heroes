const { User } = require('../models');
const { unauthorized, forbidden } = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/authService');
const subscriptionService = require('../services/subscriptionService');

function readToken(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : null;
}

/**
 * Verifies the JWT, loads the user FROM THE DATABASE (role is never taken from the client or token)
 * and performs the real-time subscription status check (PRD s04).
 */
const authenticate = asyncHandler(async (req, res, next) => {
  const token = readToken(req);
  if (!token) throw unauthorized();
  const payload = authService.verifyToken(token);
  const user = await User.findById(payload.sub);
  if (!user) throw unauthorized('Account no longer exists');
  if (user.isBlocked) throw forbidden('This account has been suspended');
  req.user = user;
  req.subscription = await subscriptionService.getWithFreshStatus(user._id);
  req.hasActiveSubscription = subscriptionService.isCurrentlyActive(req.subscription);
  next();
});

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') return next(forbidden('Administrator access required'));
  next();
};

const requireActiveSubscription = (req, res, next) => {
  if (!req.hasActiveSubscription) {
    const err = forbidden('An active subscription is required for this action');
    err.code = 'SUBSCRIPTION_REQUIRED';
    return next(err);
  }
  next();
};

module.exports = { authenticate, requireAdmin, requireActiveSubscription };
