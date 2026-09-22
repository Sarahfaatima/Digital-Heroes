const mongoose = require('mongoose');
const { bad } = require('./AppError');

const isEmail = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

function assertObjectId(id, label = 'id') {
  if (!mongoose.isValidObjectId(id)) throw bad(`Invalid ${label}`);
  return id;
}

/** Parse "YYYY-MM-DD" (or ISO) into a UTC-midnight Date. Throws 400 when invalid. */
function parseDay(input) {
  if (typeof input !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(input)) throw bad('Date must be in YYYY-MM-DD format');
  const [y, m, d] = input.slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) throw bad('Date is not a valid calendar date');
  return dt;
}

const toDayString = (d) => new Date(d).toISOString().slice(0, 10);

const monthKey = (d = new Date()) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

function addMonths(date, n) {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { isEmail, assertObjectId, parseDay, toDayString, monthKey, addMonths, escapeRegex };
