/**
 * Pure draw / prize-pool maths. No database access here so it is trivially unit-testable.
 */
const rules = require('../config/businessRules');

const { numbersCount, numberMin, numberMax, algorithmicSmoothing } = rules.draw;

/** Standard lottery draw: N distinct numbers, uniform. */
function randomNumbers(rng = Math.random) {
  const pool = [];
  for (let n = numberMin; n <= numberMax; n++) pool.push(n);
  const out = [];
  while (out.length < numbersCount) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return out.sort((a, b) => a - b);
}

/**
 * Algorithmic draw: each number's probability is proportional to how often it appears in
 * subscribers' current scores (+ smoothing so unseen numbers remain possible).
 * @param {Map<number, number>} frequency
 */
function weightedNumbers(frequency, rng = Math.random) {
  const weights = new Map();
  for (let n = numberMin; n <= numberMax; n++) weights.set(n, (frequency.get(n) || 0) + algorithmicSmoothing);
  const out = [];
  while (out.length < numbersCount) {
    let total = 0;
    for (const w of weights.values()) total += w;
    let r = rng() * total;
    let picked = null;
    for (const [n, w] of weights) {
      r -= w;
      if (r < 0) {
        picked = n;
        break;
      }
    }
    if (picked === null) picked = weights.keys().next().value;
    weights.delete(picked);
    out.push(picked);
  }
  return out.sort((a, b) => a - b);
}

/** Number of the draw numbers present in the user's (distinct) scores. */
function countMatches(scores, numbers) {
  const set = new Set(numbers);
  return [...new Set(scores)].filter((s) => set.has(s)).length;
}

/**
 * Prize-pool for a month from active subscriptions.
 * @param {{amountCents:number, plan:string}[]} subs
 */
function poolFromSubscriptions(subs) {
  return subs.reduce((sum, s) => {
    const months = rules.plans[s.plan] ? rules.plans[s.plan].intervalMonths : 1;
    return sum + Math.floor(((s.amountCents / months) * rules.prizePool.poolPercentOfFee) / 100);
  }, 0);
}

/**
 * Split the pool into tiers and compute per-winner prize.
 * @param {number} poolCents fresh pool this month
 * @param {number} rolloverInCents unclaimed jackpot carried in (added to the rollover tier)
 * @param {Record<number, number>} winnerCounts e.g. {5:0,4:2,3:10}
 * @returns {{tiers: object[], rolloverOutCents: number}}
 */
function computeTiers(poolCents, rolloverInCents, winnerCounts) {
  let rolloverOutCents = 0;
  const tiers = [5, 4, 3].map((match) => {
    const def = rules.prizePool.tiers[match];
    const tierPool = Math.floor((poolCents * def.share) / 100) + (def.rollover ? rolloverInCents : 0);
    const winnerCount = winnerCounts[match] || 0;
    const prizeEachCents = winnerCount ? Math.floor(tierPool / winnerCount) : 0;
    if (!winnerCount && def.rollover) rolloverOutCents = tierPool;
    return { match, sharePercent: def.share, poolCents: tierPool, winnerCount, prizeEachCents };
  });
  return { tiers, rolloverOutCents };
}

module.exports = { randomNumbers, weightedNumbers, countMatches, poolFromSubscriptions, computeTiers };
