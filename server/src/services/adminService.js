const { User, Subscription, Score, Draw, Winner, Contribution, DrawEntry, Charity } = require('../models');
const { bad, notFound } = require('../utils/AppError');
const { assertObjectId, escapeRegex } = require('../utils/helpers');
const auth = require('./authService');
const scoreService = require('./scoreService');
const subscriptionService = require('./subscriptionService');

async function listUsers({ search, role, status, page = 1, limit = 25 } = {}) {
  const q = {};
  if (role) q.role = role;
  if (search && String(search).trim()) {
    const re = new RegExp(escapeRegex(String(search).trim()), 'i');
    q.$or = [{ name: re }, { email: re }];
  }
  const lim = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const pg = Math.max(Number(page) || 1, 1);

  let ids;
  if (status) {
    const subs = await Subscription.find(status === 'inactive' ? { status: { $ne: 'active' } } : { status }).select('user');
    ids = subs.map((s) => s.user);
    if (status === 'inactive') {
      // users with no subscription document at all also count as inactive
      const all = await Subscription.distinct('user');
      const noSub = await User.find({ _id: { $nin: all } }).select('_id');
      ids = ids.concat(noSub.map((u) => u._id));
    }
    q._id = { $in: ids };
  }

  const [users, total] = await Promise.all([
    User.find(q).populate('charity', 'name').sort({ createdAt: -1 }).skip((pg - 1) * lim).limit(lim),
    User.countDocuments(q),
  ]);
  const subs = await Subscription.find({ user: { $in: users.map((u) => u._id) } });
  const subMap = new Map(subs.map((s) => [s.user.toString(), s]));
  return {
    total,
    page: pg,
    pages: Math.max(Math.ceil(total / lim), 1),
    items: users.map((u) => ({
      ...u.toSafe(),
      subscription: subscriptionService.present(subMap.get(u.id)),
    })),
  };
}

async function getUser(id) {
  assertObjectId(id, 'user id');
  const user = await User.findById(id).populate('charity', 'name');
  if (!user) throw notFound('User not found');
  const [scores, subscription, winnings] = await Promise.all([
    scoreService.list(id),
    subscriptionService.get(id),
    Winner.find({ user: id }).populate('draw', 'month title'),
  ]);
  return { user: user.toSafe(), scores, subscription, winnings };
}

async function updateUser(actorId, id, body) {
  assertObjectId(id, 'user id');
  const user = await User.findById(id);
  if (!user) throw notFound('User not found');
  const isSelf = actorId.toString() === id;

  if (body.name !== undefined) {
    if (String(body.name).trim().length < 2) throw bad('Name must be at least 2 characters');
    user.name = String(body.name).trim();
  }
  if (body.phone !== undefined) user.phone = String(body.phone).trim().slice(0, 30);
  if (body.country !== undefined) user.country = String(body.country).trim().slice(0, 60);
  if (body.role !== undefined) {
    if (!['user', 'admin'].includes(body.role)) throw bad('Invalid role');
    if (isSelf && body.role !== 'admin') throw bad('You cannot remove your own admin role');
    user.role = body.role;
  }
  if (body.isBlocked !== undefined) {
    if (isSelf && body.isBlocked) throw bad('You cannot block yourself');
    user.isBlocked = !!body.isBlocked;
  }
  if (body.charityId !== undefined) {
    await auth.assertCharityExists(body.charityId);
    user.charity = body.charityId;
  }
  if (body.charityPercent !== undefined) user.charityPercent = auth.validateCharityPercent(body.charityPercent);
  await user.save();

  if (body.subscription) await subscriptionService.adminUpdate(id, body.subscription);
  return getUser(id);
}

// Admin can edit a user's golf scores with exactly the same rules as the user.
const addScore = (userId, body) => (assertObjectId(userId, 'user id'), scoreService.add(userId, body));
const updateScore = (userId, scoreId, body) => (assertObjectId(userId, 'user id'), scoreService.update(userId, scoreId, body));
const deleteScore = (userId, scoreId) => (assertObjectId(userId, 'user id'), scoreService.remove(userId, scoreId));

async function reports() {
  const now = new Date();
  const [totalUsers, activeSubs, byStatus, contribByType, contribByCharity, draws, winnerAgg, latestPublished] = await Promise.all([
    User.countDocuments({ role: 'user' }),
    Subscription.countDocuments({ status: 'active', currentPeriodEnd: { $gt: now } }),
    Subscription.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Contribution.aggregate([{ $group: { _id: '$type', total: { $sum: '$amountCents' } } }]),
    Contribution.aggregate([
      { $group: { _id: '$charity', total: { $sum: '$amountCents' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'charities', localField: '_id', foreignField: '_id', as: 'c' } },
      { $project: { total: 1, count: 1, name: { $arrayElemAt: ['$c.name', 0] } } },
    ]),
    Draw.find({}).sort({ month: -1 }),
    Winner.aggregate([
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          prizeCents: { $sum: '$prizeCents' },
          paidCents: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$prizeCents', 0] } },
          pendingReview: { $sum: { $cond: [{ $eq: ['$verificationStatus', 'pending'] }, 1, 0] } },
        },
      },
    ]),
    Draw.findOne({ status: 'published' }).sort({ month: -1 }),
  ]);

  const published = draws.filter((d) => d.status === 'published');
  const contrib = Object.fromEntries(contribByType.map((c) => [c._id, c.total]));
  const w = winnerAgg[0] || { count: 0, prizeCents: 0, paidCents: 0, pendingReview: 0 };
  const jackpotCarry = latestPublished ? latestPublished.rolloverOutCents : 0;
  return {
    totalUsers,
    activeSubscribers: activeSubs,
    subscriptionsByStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.n])),
    prizePool: {
      totalDistributedCents: published.reduce((s, d) => s + d.poolCents + d.rolloverInCents - d.rolloverOutCents, 0),
      totalGeneratedCents: published.reduce((s, d) => s + d.poolCents, 0),
      jackpotCarryCents: jackpotCarry,
    },
    charity: {
      subscriptionCents: contrib.subscription || 0,
      donationCents: contrib.donation || 0,
      totalCents: (contrib.subscription || 0) + (contrib.donation || 0),
      byCharity: contribByCharity.map((c) => ({ id: c._id, name: c.name || 'Removed charity', totalCents: c.total, count: c.count })),
    },
    draws: {
      total: draws.length,
      published: published.length,
      recent: draws.slice(0, 6).map((d) => ({
        id: d._id,
        month: d.month,
        status: d.status,
        mode: d.mode,
        participants: d.participants,
        poolCents: d.poolCents,
        winners: d.tiers.reduce((s, t) => s + t.winnerCount, 0),
        rolloverOutCents: d.rolloverOutCents,
      })),
    },
    winners: { count: w.count, prizeCents: w.prizeCents, paidCents: w.paidCents, pendingReview: w.pendingReview },
  };
}

module.exports = { listUsers, getUser, updateUser, addScore, updateScore, deleteScore, reports };
