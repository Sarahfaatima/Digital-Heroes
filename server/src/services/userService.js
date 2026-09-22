const bcrypt = require('bcrypt');
const { User, Charity, Draw, DrawEntry, Contribution } = require('../models');
const { bad, notFound } = require('../utils/AppError');
const auth = require('./authService');
const scoreService = require('./scoreService');
const subscriptionService = require('./subscriptionService');
const winnerService = require('./winnerService');
const drawService = require('./drawService');

async function getProfile(userId) {
  const user = await User.findById(userId).populate('charity', 'name imageUrl category');
  if (!user) throw notFound('User not found');
  return user.toSafe();
}

async function updateProfile(userId, { name, phone, country, currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw notFound('User not found');
  if (name !== undefined) {
    if (String(name).trim().length < 2) throw bad('Name must be at least 2 characters');
    user.name = String(name).trim();
  }
  if (phone !== undefined) user.phone = String(phone).trim().slice(0, 30);
  if (country !== undefined) user.country = String(country).trim().slice(0, 60);
  if (newPassword) {
    if (!currentPassword || !(await bcrypt.compare(currentPassword, user.passwordHash))) throw bad('Current password is incorrect');
    auth.validatePassword(newPassword);
    user.passwordHash = await bcrypt.hash(newPassword, 10);
  }
  await user.save();
  return user.toSafe();
}

/** Select charity and/or contribution percentage (minimum enforced by config). */
async function setCharity(userId, { charityId, charityPercent }) {
  const user = await User.findById(userId);
  if (!user) throw notFound('User not found');
  if (charityId === undefined && charityPercent === undefined) throw bad('Provide charityId and/or charityPercent');
  if (charityId !== undefined) {
    await auth.assertCharityExists(charityId);
    user.charity = charityId;
  }
  if (charityPercent !== undefined) user.charityPercent = auth.validateCharityPercent(charityPercent);
  await user.save();
  return getProfile(userId);
}

async function contributionSummary(userId) {
  const rows = await Contribution.aggregate([
    { $match: { user: userId } },
    { $group: { _id: '$type', total: { $sum: '$amountCents' }, count: { $sum: 1 } } },
  ]);
  const by = Object.fromEntries(rows.map((r) => [r._id, r]));
  const subscriptionCents = by.subscription ? by.subscription.total : 0;
  const donationCents = by.donation ? by.donation.total : 0;
  return { subscriptionCents, donationCents, totalCents: subscriptionCents + donationCents };
}

async function myDraws(userId) {
  const [entries, { upcoming }] = await Promise.all([
    DrawEntry.find({ user: userId }).populate('draw', 'month title numbers status mode').sort({ createdAt: -1 }),
    drawService.listPublic(),
  ]);
  return {
    entered: entries
      .filter((e) => e.draw)
      .map((e) => ({ id: e._id, draw: e.draw, scores: e.scores, matches: e.matches, won: e.matches >= 3 })),
    upcoming,
  };
}

async function dashboard(userId, subscription) {
  const [profile, scores, sub, winnings, draws, contributions] = await Promise.all([
    getProfile(userId),
    scoreService.list(userId),
    subscriptionService.get(userId),
    winnerService.listMine(userId),
    myDraws(userId),
    contributionSummary(userId),
  ]);
  const charity = profile.charity && profile.charity.name ? profile.charity : null;
  return {
    user: { id: profile._id, name: profile.name, email: profile.email },
    subscription: sub,
    scores,
    charity,
    charityPercent: profile.charityPercent,
    contributions,
    draws: {
      enteredCount: draws.entered.length,
      entered: draws.entered.slice(0, 5),
      upcoming: draws.upcoming,
      eligibleForNextDraw: sub.isActive && scores.length > 0,
    },
    winnings: {
      totalWonCents: winnings.totalWonCents,
      paidCents: winnings.paidCents,
      pendingCents: winnings.pendingCents,
      count: winnings.items.length,
      awaitingProof: winnings.items.filter((w) => w.verificationStatus === 'awaiting_proof' || w.verificationStatus === 'rejected').length,
      latestPaymentStatus: winnings.items[0] ? winnings.items[0].paymentStatus : null,
    },
  };
}

module.exports = { getProfile, updateProfile, setCharity, dashboard, myDraws, contributionSummary };
