const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config');
const rules = require('../config/businessRules');
const { User, Charity } = require('../models');
const { bad, conflict, unauthorized } = require('../utils/AppError');
const { isEmail, assertObjectId } = require('../utils/helpers');

const signToken = (user) => jwt.sign({ sub: user._id.toString() }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

function validatePassword(pw) {
  if (typeof pw !== 'string' || pw.length < 8) throw bad('Password must be at least 8 characters');
  if (pw.length > 72) throw bad('Password must be at most 72 characters');
}

function validateCharityPercent(p) {
  const n = Number(p);
  if (!Number.isFinite(n) || n < rules.charity.minPercent || n > rules.charity.maxPercent) {
    throw bad(`Charity contribution must be between ${rules.charity.minPercent}% and ${rules.charity.maxPercent}%`);
  }
  return n;
}

async function assertCharityExists(id) {
  assertObjectId(id, 'charity id');
  const c = await Charity.findOne({ _id: id, active: true }).select('_id');
  if (!c) throw bad('Selected charity does not exist');
}

async function register({ name, email, password, charityId, charityPercent }) {
  if (!name || String(name).trim().length < 2) throw bad('Name must be at least 2 characters');
  if (!isEmail(email)) throw bad('Please provide a valid email address');
  validatePassword(password);

  const doc = { name: String(name).trim(), email: String(email).toLowerCase().trim(), role: 'user' };
  if (charityId) {
    await assertCharityExists(charityId);
    doc.charity = charityId;
  }
  if (charityPercent !== undefined && charityPercent !== '') doc.charityPercent = validateCharityPercent(charityPercent);

  if (await User.exists({ email: doc.email })) throw conflict('An account with this email already exists');
  doc.passwordHash = await bcrypt.hash(password, 10);
  try {
    const user = await User.create(doc);
    return { user: user.toSafe(), token: signToken(user) };
  } catch (e) {
    if (e.code === 11000) throw conflict('An account with this email already exists');
    throw e;
  }
}

async function login({ email, password }) {
  if (!isEmail(email) || typeof password !== 'string') throw unauthorized('Invalid email or password');
  const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select('+passwordHash');
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) throw unauthorized('Invalid email or password');
  if (user.isBlocked) throw unauthorized('This account has been suspended');
  return { user: user.toSafe(), token: signToken(user) };
}

function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch {
    throw unauthorized('Session expired or invalid. Please log in again.');
  }
}

module.exports = { register, login, verifyToken, validateCharityPercent, assertCharityExists, validatePassword };
