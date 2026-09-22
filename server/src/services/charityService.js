const { Charity, User, Contribution } = require('../models');
const rules = require('../config/businessRules');
const { bad, notFound, conflict } = require('../utils/AppError');
const { assertObjectId, escapeRegex } = require('../utils/helpers');

const EDITABLE = ['name', 'shortDescription', 'description', 'category', 'imageUrl', 'gallery', 'website', 'featured', 'active', 'events'];

function pick(body) {
  const out = {};
  for (const k of EDITABLE) if (body[k] !== undefined) out[k] = body[k];
  if (out.gallery && !Array.isArray(out.gallery)) throw bad('gallery must be an array of image URLs');
  if (out.events) {
    if (!Array.isArray(out.events)) throw bad('events must be an array');
    for (const ev of out.events) {
      if (!ev || !ev.title || !ev.date || Number.isNaN(new Date(ev.date).getTime())) throw bad('Each event needs a title and a valid date');
    }
  }
  return out;
}

/** Public directory: search text, category filter, featured filter. */
async function listPublic({ search, category, featured } = {}) {
  const q = { active: true };
  if (category && category !== 'all') q.category = category;
  if (featured === 'true') q.featured = true;
  if (search && String(search).trim()) {
    const re = new RegExp(escapeRegex(String(search).trim()), 'i');
    q.$or = [{ name: re }, { shortDescription: re }, { description: re }, { category: re }];
  }
  const [items, categories] = await Promise.all([
    Charity.find(q).sort({ featured: -1, name: 1 }),
    Charity.distinct('category', { active: true }),
  ]);
  return { items, categories: categories.sort() };
}

async function getPublic(id) {
  assertObjectId(id, 'charity id');
  const c = await Charity.findOne({ _id: id, active: true });
  if (!c) throw notFound('Charity not found');
  const [supporters, raised] = await Promise.all([
    User.countDocuments({ charity: c._id }),
    Contribution.aggregate([{ $match: { charity: c._id } }, { $group: { _id: null, total: { $sum: '$amountCents' } } }]),
  ]);
  const o = c.toObject();
  o.events = (o.events || []).sort((a, b) => new Date(a.date) - new Date(b.date));
  return { ...o, supporters, raisedCents: raised[0] ? raised[0].total : 0 };
}

async function adminList() {
  return Charity.find({}).sort({ featured: -1, name: 1 });
}

async function create(body) {
  const data = pick(body);
  if (!data.name || !String(data.name).trim()) throw bad('Charity name is required');
  try {
    const c = await Charity.create(data);
    if (c.featured) await Charity.updateMany({ _id: { $ne: c._id } }, { featured: false });
    return c;
  } catch (e) {
    if (e.code === 11000) throw conflict('A charity with this name already exists');
    throw e;
  }
}

async function update(id, body) {
  assertObjectId(id, 'charity id');
  const c = await Charity.findById(id);
  if (!c) throw notFound('Charity not found');
  Object.assign(c, pick(body));
  try {
    await c.save();
  } catch (e) {
    if (e.code === 11000) throw conflict('A charity with this name already exists');
    throw e;
  }
  // Only one featured charity at a time (homepage spotlight)
  if (c.featured) await Charity.updateMany({ _id: { $ne: c._id } }, { featured: false });
  return c;
}

async function remove(id) {
  assertObjectId(id, 'charity id');
  const c = await Charity.findById(id);
  if (!c) throw notFound('Charity not found');
  const inUse = await User.countDocuments({ charity: c._id });
  if (inUse) {
    // Keep history intact: users still reference it, so hide instead of hard delete.
    c.active = false;
    c.featured = false;
    await c.save();
    return { deleted: false, deactivated: true, message: `${inUse} subscriber(s) support this charity, so it was deactivated instead of deleted.` };
  }
  await c.deleteOne();
  return { deleted: true };
}

/** Independent donation, not tied to gameplay or subscription. */
async function donate(userId, { charityId, amountCents }) {
  const cents = Number(amountCents);
  if (!Number.isInteger(cents) || cents < rules.charity.minDonationCents) {
    throw bad(`Minimum donation is ${(rules.charity.minDonationCents / 100).toFixed(2)} ${rules.currency}`);
  }
  if (cents > 1000000) throw bad('Donation is too large for the demo payment flow');
  assertObjectId(charityId, 'charity id');
  const c = await Charity.findOne({ _id: charityId, active: true });
  if (!c) throw notFound('Charity not found');
  return Contribution.create({ user: userId, charity: c._id, type: 'donation', amountCents: cents, note: 'Independent donation' });
}

module.exports = { listPublic, getPublic, adminList, create, update, remove, donate };
