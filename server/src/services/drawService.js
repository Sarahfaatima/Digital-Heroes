const rules = require('../config/businessRules');
const { Draw, DrawEntry, Winner, Subscription, Score, User } = require('../models');
const { bad, notFound, conflict } = require('../utils/AppError');
const { monthKey, assertObjectId } = require('../utils/helpers');
const engine = require('../utils/drawEngine');

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const monthTitle = (m) =>
  new Date(`${m}-01T00:00:00Z`).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) + ' Draw';

const presentDraw = (d, { reveal = true } = {}) => {
  const o = d.toObject ? d.toObject() : d;
  const published = o.status === 'published';
  return {
    id: o._id,
    month: o.month,
    title: o.title,
    mode: o.mode,
    status: o.status,
    numbers: published || reveal ? o.numbers : [],
    participants: o.participants,
    activeSubscribers: o.activeSubscribers,
    poolCents: o.poolCents,
    rolloverInCents: o.rolloverInCents,
    rolloverOutCents: o.rolloverOutCents,
    totalPrizePoolCents: (o.poolCents || 0) + (o.rolloverInCents || 0),
    tiers: published || reveal ? o.tiers : [],
    simulatedAt: o.simulatedAt,
    publishedAt: o.publishedAt,
  };
};

/** Make sure there is always an upcoming (unpublished) draw for the current or next month. */
async function ensureUpcomingDraw() {
  const now = new Date();
  let month = monthKey(now);
  const existing = await Draw.findOne({ month });
  if (existing && existing.status === 'published') {
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    month = monthKey(next);
  }
  return Draw.findOneAndUpdate(
    { month },
    { $setOnInsert: { month, title: monthTitle(month), status: 'draft', mode: 'random' } },
    { upsert: true, returnDocument: 'after' }
  );
}

async function rolloverInFor(month) {
  const prev = await Draw.findOne({ status: 'published', month: { $lt: month } }).sort({ month: -1 });
  return prev ? prev.rolloverOutCents || 0 : 0;
}

/** Load everything a draw needs: active subs, eligible participants and their scores. */
async function gatherParticipants() {
  const now = new Date();
  const subs = await Subscription.find({ status: 'active', currentPeriodEnd: { $gt: now } }).select('user amountCents plan');
  const userIds = subs.map((s) => s.user);
  const [scores, users] = await Promise.all([
    Score.find({ user: { $in: userIds } }).select('user value'),
    User.find({ _id: { $in: userIds }, isBlocked: false }).select('name email'),
  ]);
  const ok = new Set(users.map((u) => u.id));
  const byUser = new Map();
  for (const s of scores) {
    const k = s.user.toString();
    if (!byUser.has(k)) byUser.set(k, []);
    byUser.get(k).push(s.value);
  }
  const participants = [];
  for (const u of users) {
    const sc = byUser.get(u.id) || [];
    if (sc.length >= rules.draw.minScoresToEnter) participants.push({ user: u, scores: sc });
  }
  const frequency = new Map();
  for (const p of participants) for (const v of new Set(p.scores)) frequency.set(v, (frequency.get(v) || 0) + 1);
  return { subs: subs.filter((s) => ok.has(s.user.toString())), participants, frequency };
}

/** Evaluate a set of draw numbers against the current participants. */
async function evaluate(month, numbers, data) {
  const matched = data.participants
    .map((p) => ({ ...p, matches: engine.countMatches(p.scores, numbers) }))
    .filter((p) => p.matches >= 3);
  const counts = { 5: 0, 4: 0, 3: 0 };
  matched.forEach((p) => (counts[p.matches] += 1));
  const poolCents = engine.poolFromSubscriptions(data.subs);
  const rolloverInCents = await rolloverInFor(month);
  const { tiers, rolloverOutCents } = engine.computeTiers(poolCents, rolloverInCents, counts);
  return { matched, tiers, poolCents, rolloverInCents, rolloverOutCents };
}

const winnersPreview = (matched, tiers) =>
  matched
    .map((p) => ({
      userId: p.user.id,
      name: p.user.name,
      email: p.user.email,
      scores: p.scores,
      matchType: p.matches,
      prizeCents: tiers.find((t) => t.match === p.matches).prizeEachCents,
    }))
    .sort((a, b) => b.matchType - a.matchType);

function validateConfig({ month, mode }) {
  if (month !== undefined && !MONTH_RE.test(month)) throw bad('month must be in YYYY-MM format');
  if (mode !== undefined && !rules.draw.modes.includes(mode)) throw bad(`mode must be one of: ${rules.draw.modes.join(', ')}`);
}

/** Configure + run a simulation. Does not create winners or touch users. */
async function simulate({ month, mode = 'random' } = {}) {
  validateConfig({ month, mode });
  const target = month || (await ensureUpcomingDraw()).month;
  let draw = await Draw.findOne({ month: target });
  if (draw && draw.status === 'published') throw conflict(`The ${target} draw has already been published`);
  if (!draw) draw = new Draw({ month: target, title: monthTitle(target) });

  const data = await gatherParticipants();
  const numbers = mode === 'algorithmic' ? engine.weightedNumbers(data.frequency) : engine.randomNumbers();
  const ev = await evaluate(target, numbers, data);

  Object.assign(draw, {
    mode,
    status: 'simulated',
    numbers,
    activeSubscribers: data.subs.length,
    participants: data.participants.length,
    poolCents: ev.poolCents,
    rolloverInCents: ev.rolloverInCents,
    rolloverOutCents: ev.rolloverOutCents,
    tiers: ev.tiers,
    simulatedAt: new Date(),
  });
  await draw.save();
  return { draw: presentDraw(draw), winners: winnersPreview(ev.matched, ev.tiers) };
}

/** Publish a previously simulated draw: persists entries + winners and handles jackpot rollover. */
async function publish({ drawId, month }, adminId) {
  let draw;
  if (drawId) {
    assertObjectId(drawId, 'draw id');
    draw = await Draw.findById(drawId);
  } else if (month) {
    validateConfig({ month });
    draw = await Draw.findOne({ month });
  }
  if (!draw) throw notFound('Draw not found - simulate a draw first');
  if (draw.status === 'published') throw conflict('This draw has already been published');
  if (draw.status !== 'simulated' || draw.numbers.length !== rules.draw.numbersCount) {
    throw bad('Run a simulation before publishing this draw');
  }

  // Atomic claim so two admins cannot publish the same draw twice.
  const claimed = await Draw.findOneAndUpdate(
    { _id: draw._id, status: 'simulated' },
    { $set: { status: 'published', publishedAt: new Date(), publishedBy: adminId } },
    { returnDocument: 'after' }
  );
  if (!claimed) throw conflict('This draw has already been published');

  try {
    const data = await gatherParticipants();
    const ev = await evaluate(claimed.month, claimed.numbers, data);

    await DrawEntry.insertMany(
      data.participants.map((p) => ({
        draw: claimed._id,
        user: p.user.id,
        scores: p.scores,
        matches: engine.countMatches(p.scores, claimed.numbers),
      })),
      { ordered: true }
    );
    const winners = winnersPreview(ev.matched, ev.tiers);
    if (winners.length) {
      await Winner.insertMany(
        winners.map((w) => ({ draw: claimed._id, user: w.userId, matchType: w.matchType, prizeCents: w.prizeCents })),
        { ordered: true }
      );
    }
    Object.assign(claimed, {
      activeSubscribers: data.subs.length,
      participants: data.participants.length,
      poolCents: ev.poolCents,
      rolloverInCents: ev.rolloverInCents,
      rolloverOutCents: ev.rolloverOutCents,
      tiers: ev.tiers,
    });
    await claimed.save();
    await ensureUpcomingDraw();
    return { draw: presentDraw(claimed), winners };
  } catch (e) {
    // Roll back the claim so the admin can retry.
    await Promise.all([DrawEntry.deleteMany({ draw: claimed._id }), Winner.deleteMany({ draw: claimed._id })]);
    await Draw.updateOne({ _id: claimed._id }, { $set: { status: 'simulated' }, $unset: { publishedAt: 1, publishedBy: 1 } });
    throw e;
  }
}

async function listPublic() {
  await ensureUpcomingDraw();
  const draws = await Draw.find({}).sort({ month: -1 });
  const published = draws.filter((d) => d.status === 'published').map((d) => presentDraw(d));
  const upcoming = draws
    .filter((d) => d.status !== 'published')
    .map((d) => presentDraw(d, { reveal: false }))
    .map((d) => ({ ...d, mode: d.mode, rolloverInCents: d.rolloverInCents }));
  return { published, upcoming };
}

async function getPublic(id, userId) {
  assertObjectId(id, 'draw id');
  const draw = await Draw.findById(id);
  if (!draw) throw notFound('Draw not found');
  const out = presentDraw(draw, { reveal: false });
  if (draw.status === 'published') {
    out.winnerCounts = Object.fromEntries(draw.tiers.map((t) => [t.match, t.winnerCount]));
    if (userId) {
      const [entry, win] = await Promise.all([
        DrawEntry.findOne({ draw: draw._id, user: userId }),
        Winner.findOne({ draw: draw._id, user: userId }),
      ]);
      out.myEntry = entry ? { scores: entry.scores, matches: entry.matches } : null;
      out.myWin = win ? { id: win._id, matchType: win.matchType, prizeCents: win.prizeCents } : null;
    }
  }
  return out;
}

async function adminList() {
  await ensureUpcomingDraw();
  const draws = await Draw.find({}).sort({ month: -1 });
  return draws.map((d) => presentDraw(d));
}

module.exports = { simulate, publish, listPublic, getPublic, adminList, ensureUpcomingDraw, presentDraw, gatherParticipants };
