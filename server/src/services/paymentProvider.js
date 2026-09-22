/**
 * Payment provider abstraction.
 *
 * Only a DEMO provider is implemented (no real money moves). To go live, add a `stripe`
 * provider exposing the same `charge()` contract and select it with PAYMENT_PROVIDER=stripe.
 * Nothing outside this file knows how a payment is processed.
 *
 * charge({ userId, plan, amountCents, simulateFailure }) -> { status: 'succeeded'|'failed', ref, message? }
 */
const crypto = require('crypto');
const config = require('../config');

const demoProvider = {
  name: 'demo',
  async charge({ amountCents, simulateFailure }) {
    if (simulateFailure) return { status: 'failed', ref: null, message: 'Demo card declined (simulated failure)' };
    return { status: 'succeeded', ref: `demo_${crypto.randomBytes(6).toString('hex')}`, amountCents };
  },
};

const providers = { demo: demoProvider };

function getProvider() {
  return providers[config.paymentProvider] || demoProvider;
}

module.exports = { getProvider };
