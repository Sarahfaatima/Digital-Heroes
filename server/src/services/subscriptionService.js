const rules = require('../config/businessRules');
const { Subscription, User, Contribution } = require('../models');
const { bad, notFound, AppError } = require('../utils/AppError');
const { addMonths } = require('../utils/helpers');
const { getProvider } = require('./paymentProvider');

const isCurrentlyActive = (sub, now = new Date()) =>
  !!sub && sub.status === 'active' && sub.currentPeriodEnd && sub.currentPeriodEnd > now;

/**
 * Real-time status check: if an active subscription has passed its period end it becomes "lapsed".
 * Called on every authenticated request (see middleware/auth.js).
 */
async function getWithFreshStatus(userId) {
  const sub = await Subscription.findOne({ user: userId });
  if (sub && sub.status === 'active' && sub.currentPeriodEnd <= new Date()) {
    sub.status = 'lapsed';
    await sub.save();
  }
  return sub;
}

function present(sub) {
  if (!sub) {
    return { status: 'inactive', isActive: false, plan: null, renewalDate: null, plans: rules.plans };
  }
  return {
    id: sub._id,
    status: sub.status,
    isActive: isCurrentlyActive(sub),
    plan: sub.plan,
    amountCents: sub.amountCents,
    startedAt: sub.startedAt,
    renewalDate: sub.status === 'active' ? sub.currentPeriodEnd : null,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelledAt: sub.cancelledAt,
    lastPaymentStatus: sub.lastPaymentStatus,
    lastPaymentAt: sub.lastPaymentAt,
    payments: (sub.payments || []).slice(-5).reverse(),
    provider: sub.provider,
    plans: rules.plans,
  };
}

async function get(userId) {
  return present(await getWithFreshStatus(userId));
}

/** Activate or renew a subscription through the payment provider. */
async function activate(userId, { plan, simulateFailure } = {}) {
  const planDef = rules.plans[plan];
  if (!planDef) throw bad('Plan must be "monthly" or "yearly"');

  const user = await User.findById(userId);
  if (!user) throw notFound('User not found');
  if (!user.charity) throw bad('Please select a charity before subscribing - part of your fee goes to it.');

  const payment = await getProvider().charge({ userId, plan, amountCents: planDef.priceCents, simulateFailure: !!simulateFailure });

  let sub = await Subscription.findOne({ user: userId });
  const now = new Date();

  if (payment.status !== 'succeeded') {
    if (sub) {
      sub.lastPaymentStatus = 'failed';
      sub.payments.push({ at: now, amountCents: planDef.priceCents, plan, status: 'failed', ref: payment.ref });
      await sub.save();
    }
    throw new AppError(402, payment.message || 'Payment failed');
  }

  // Renewing while still active extends from the current period end, otherwise start now.
  const base = isCurrentlyActive(sub, now) ? sub.currentPeriodEnd : now;
  const periodEnd = addMonths(base, planDef.intervalMonths);
  const fields = {
    plan,
    status: 'active',
    amountCents: planDef.priceCents,
    currentPeriodStart: base,
    currentPeriodEnd: periodEnd,
    cancelledAt: null,
    provider: getProvider().name,
    providerRef: payment.ref,
    lastPaymentStatus: 'succeeded',
    lastPaymentAt: now,
  };
  if (!sub) sub = new Subscription({ user: userId, startedAt: now, ...fields });
  else {
    Object.assign(sub, fields);
    if (!sub.startedAt) sub.startedAt = now;
  }
  sub.payments.push({ at: now, amountCents: planDef.priceCents, plan, status: 'succeeded', ref: payment.ref });
  await sub.save();

  // Charity share of the fee
  const charityCents = Math.round((planDef.priceCents * user.charityPercent) / 100);
  if (charityCents > 0) {
    await Contribution.create({
      user: userId,
      charity: user.charity,
      type: 'subscription',
      amountCents: charityCents,
      percent: user.charityPercent,
      note: `${planDef.label} plan payment`,
    });
  }
  return present(sub);
}

async function cancel(userId) {
  const sub = await getWithFreshStatus(userId);
  if (!sub || sub.status !== 'active') throw bad('You do not have an active subscription to cancel');
  sub.status = 'cancelled';
  sub.cancelledAt = new Date();
  await sub.save();
  return present(sub);
}

/** Admin override: set status / plan / extend without payment. */
async function adminUpdate(userId, { status, plan, extendMonths }) {
  let sub = await Subscription.findOne({ user: userId });
  const now = new Date();
  if (plan && !rules.plans[plan]) throw bad('Invalid plan');
  if (status && !['active', 'cancelled', 'lapsed', 'inactive'].includes(status)) throw bad('Invalid subscription status');
  if (!sub) {
    const p = rules.plans[plan || 'monthly'];
    sub = new Subscription({ user: userId, plan: p.id, amountCents: p.priceCents, status: 'inactive', provider: 'admin' });
  }
  if (plan) {
    sub.plan = plan;
    sub.amountCents = rules.plans[plan].priceCents;
  }
  if (extendMonths) {
    const n = Number(extendMonths);
    if (!Number.isInteger(n) || n < 1 || n > 24) throw bad('extendMonths must be between 1 and 24');
    const base = sub.currentPeriodEnd && sub.currentPeriodEnd > now ? sub.currentPeriodEnd : now;
    sub.currentPeriodEnd = addMonths(base, n);
    sub.currentPeriodStart = sub.currentPeriodStart || now;
    sub.startedAt = sub.startedAt || now;
    if (!status) sub.status = 'active';
  }
  if (status) {
    sub.status = status;
    if (status === 'active' && (!sub.currentPeriodEnd || sub.currentPeriodEnd <= now)) {
      sub.currentPeriodStart = now;
      sub.currentPeriodEnd = addMonths(now, rules.plans[sub.plan].intervalMonths);
      sub.startedAt = sub.startedAt || now;
    }
    if (status === 'cancelled') sub.cancelledAt = now;
  }
  await sub.save();
  return present(sub);
}

module.exports = { get, getWithFreshStatus, activate, cancel, adminUpdate, present, isCurrentlyActive };
