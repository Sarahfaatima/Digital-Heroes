/**
 * Single source of truth for every business number in the platform.
 * Change values here – nothing else in the codebase hard-codes them.
 * All money is stored in integer cents.
 */
module.exports = {
  currency: 'USD',

  plans: {
    monthly: { id: 'monthly', label: 'Monthly', priceCents: 1000, intervalMonths: 1 },
    // Yearly = 10 months for the price of 12 (~17% discount)
    yearly: { id: 'yearly', label: 'Yearly', priceCents: 10000, intervalMonths: 12 },
  },

  scores: {
    min: 1,
    max: 45,
    maxStored: 5, // only the latest 5 (by date) are retained
  },

  charity: {
    minPercent: 10, // PRD: minimum 10% of the subscription fee
    maxPercent: 100,
    defaultPercent: 10,
    minDonationCents: 100,
  },

  prizePool: {
    // ASSUMPTION: 50% of every subscription fee (monthly-equivalent) funds the prize pool.
    poolPercentOfFee: 50,
    // PRD: 5-match 40% (jackpot, rolls over), 4-match 35%, 3-match 25%
    tiers: {
      5: { share: 40, rollover: true },
      4: { share: 35, rollover: false },
      3: { share: 25, rollover: false },
    },
  },

  draw: {
    numbersCount: 5,
    numberMin: 1,
    numberMax: 45,
    modes: ['random', 'algorithmic'],
    // A subscriber enters a draw if active and holds at least this many scores.
    minScoresToEnter: 1,
    // Algorithmic mode: every number gets weight = frequency + smoothing so unseen numbers stay possible.
    algorithmicSmoothing: 1,
  },

  winners: {
    maxProofBytes: 2 * 1024 * 1024,
    allowedProofTypes: ['image/png', 'image/jpeg', 'image/webp'],
  },
};
