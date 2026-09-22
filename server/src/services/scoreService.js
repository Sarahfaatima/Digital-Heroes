const rules = require('../config/businessRules');
const { Score } = require('../models');
const { bad, conflict, notFound } = require('../utils/AppError');
const { parseDay, assertObjectId, toDayString } = require('../utils/helpers');

const format = (s) => ({ id: s._id, value: s.value, date: toDayString(s.date), updatedAt: s.updatedAt });

function validateValue(v) {
  const n = Number(v);
  if (v === '' || v === null || v === undefined || !Number.isInteger(n)) throw bad('Score must be a whole number');
  if (n < rules.scores.min || n > rules.scores.max) {
    throw bad(`Score must be between ${rules.scores.min} and ${rules.scores.max} (Stableford)`);
  }
  return n;
}

function validateDate(input) {
  const date = parseDay(input);
  const today = parseDay(new Date().toISOString().slice(0, 10));
  if (date > today) throw bad('Score date cannot be in the future');
  return date;
}

/** Newest first. Always at most `maxStored` rows. */
async function list(userId) {
  const rows = await Score.find({ user: userId }).sort({ date: -1 }).limit(rules.scores.maxStored);
  return rows.map(format);
}

async function add(userId, { value, date }) {
  const v = validateValue(value);
  const d = validateDate(date);

  if (await Score.exists({ user: userId, date: d })) {
    throw conflict('You already have a score for this date. Edit or delete the existing entry instead.');
  }

  // With a full set, a score older than every stored score would be the "oldest" and be dropped immediately.
  const current = await Score.find({ user: userId }).sort({ date: -1 });
  if (current.length >= rules.scores.maxStored && d < current[current.length - 1].date) {
    throw bad(`Only your latest ${rules.scores.maxStored} rounds are kept - this date is older than all of them.`);
  }

  let created;
  try {
    created = await Score.create({ user: userId, value: v, date: d });
  } catch (e) {
    if (e.code === 11000) throw conflict('You already have a score for this date. Edit or delete the existing entry instead.');
    throw e;
  }

  // Rollover: keep the newest N by date, remove the oldest extras.
  const all = await Score.find({ user: userId }).sort({ date: -1 }).select('_id');
  const extras = all.slice(rules.scores.maxStored);
  let removed = [];
  if (extras.length) {
    await Score.deleteMany({ _id: { $in: extras.map((e) => e._id) } });
    removed = extras.map((e) => e._id);
  }
  return { score: format(created), removedIds: removed };
}

async function update(userId, id, { value, date }) {
  assertObjectId(id, 'score id');
  const score = await Score.findOne({ _id: id, user: userId });
  if (!score) throw notFound('Score not found');

  if (value !== undefined) score.value = validateValue(value);
  if (date !== undefined) {
    const d = validateDate(date);
    if (d.getTime() !== score.date.getTime()) {
      if (await Score.exists({ user: userId, date: d, _id: { $ne: score._id } })) {
        throw conflict('You already have a score for this date.');
      }
      score.date = d;
    }
  }
  try {
    await score.save();
  } catch (e) {
    if (e.code === 11000) throw conflict('You already have a score for this date.');
    throw e;
  }
  return format(score);
}

async function remove(userId, id) {
  assertObjectId(id, 'score id');
  const res = await Score.deleteOne({ _id: id, user: userId });
  if (!res.deletedCount) throw notFound('Score not found');
}

module.exports = { list, add, update, remove, format };
