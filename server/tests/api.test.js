/**
 * End-to-end API tests against an in-memory MongoDB.  Run: npm test
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let server;
let base;
const tok = {};

async function api(method, path, { body, token, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(base + path, { method, headers, body: payload });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
  return { status: res.status, data };
}

const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('dh_test');
  process.env.JWT_SECRET = 'test-secret';
  const { connectDb } = require('../src/config/db');
  await connectDb(process.env.MONGODB_URI);
  await require('../src/seed/seed').seed({ log: () => {} });
  server = require('../src/app').listen(0);
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  server.close();
  await require('mongoose').disconnect();
  await mongod.stop();
});

test('auth: register, duplicate email, login, me, invalid login', async () => {
  const ch = (await api('GET', '/charities')).data.items[0];
  let r = await api('POST', '/auth/register', { body: { name: 'Tess Tester', email: 'tess@test.dev', password: 'Password1', charityId: ch._id, charityPercent: 12 } });
  assert.equal(r.status, 201);
  assert.equal(r.data.user.role, 'user');
  assert.equal(r.data.user.passwordHash, undefined);
  tok.tess = r.data.token;
  r = await api('POST', '/auth/register', { body: { name: 'Tess Again', email: 'TESS@test.dev', password: 'Password1' } });
  assert.equal(r.status, 409);
  r = await api('POST', '/auth/register', { body: { name: 'X', email: 'bad', password: '1' } });
  assert.equal(r.status, 400);
  r = await api('POST', '/auth/register', { body: { name: 'Role Hack', email: 'hack@test.dev', password: 'Password1', role: 'admin' } });
  assert.equal(r.data.user.role, 'user', 'role from client is ignored');
  r = await api('POST', '/auth/login', { body: { email: 'tess@test.dev', password: 'nope' } });
  assert.equal(r.status, 401);
  r = await api('POST', '/auth/login', { body: { email: 'tess@test.dev', password: 'Password1' } });
  assert.equal(r.status, 200);
  r = await api('GET', '/auth/me', { token: tok.tess });
  assert.equal(r.data.user.email, 'tess@test.dev');
  assert.equal(r.data.subscription.isActive, false);
  r = await api('GET', '/auth/me');
  assert.equal(r.status, 401);
});

test('roles: user blocked from admin API, admin allowed', async () => {
  let r = await api('GET', '/admin/users', { token: tok.tess });
  assert.equal(r.status, 403);
  r = await api('GET', '/admin/users');
  assert.equal(r.status, 401);
  r = await api('POST', '/auth/login', { body: { email: 'admin@digitalheroes.demo', password: 'Admin@12345' } });
  tok.admin = r.data.token;
  r = await api('GET', '/admin/users', { token: tok.admin });
  assert.equal(r.status, 200);
  assert.ok(r.data.total >= 9);
});

test('subscription gate, activation (monthly/yearly), failure, cancel', async () => {
  let r = await api('POST', '/scores', { token: tok.tess, body: { value: 20, date: day(1) } });
  assert.equal(r.status, 403);
  assert.equal(r.data.code, 'SUBSCRIPTION_REQUIRED');
  r = await api('POST', '/subscription', { token: tok.tess, body: { plan: 'weekly' } });
  assert.equal(r.status, 400);
  r = await api('POST', '/subscription', { token: tok.tess, body: { plan: 'monthly', simulateFailure: true } });
  assert.equal(r.status, 402);
  r = await api('POST', '/subscription', { token: tok.tess, body: { plan: 'yearly' } });
  assert.equal(r.status, 201);
  assert.equal(r.data.subscription.isActive, true);
  assert.equal(r.data.subscription.plan, 'yearly');
  const end = new Date(r.data.subscription.renewalDate);
  assert.ok(end.getTime() - Date.now() > 300 * 86400000);
  r = await api('POST', '/subscription/cancel', { token: tok.tess });
  assert.equal(r.data.subscription.status, 'cancelled');
  assert.equal(r.data.subscription.isActive, false);
  r = await api('POST', '/subscription/cancel', { token: tok.tess });
  assert.equal(r.status, 400);
  r = await api('POST', '/subscription', { token: tok.tess, body: { plan: 'monthly' } });
  assert.equal(r.data.subscription.isActive, true);
});

test('lapsed subscription is detected on request', async () => {
  const { Subscription, User } = require('../src/models');
  const u = await User.findOne({ email: 'tess@test.dev' });
  await Subscription.updateOne({ user: u._id }, { currentPeriodEnd: new Date(Date.now() - 1000) });
  let r = await api('GET', '/subscription', { token: tok.tess });
  assert.equal(r.data.subscription.status, 'lapsed');
  r = await api('POST', '/subscription', { token: tok.tess, body: { plan: 'monthly' } });
  assert.equal(r.data.subscription.isActive, true);
});

test('scores: validation, duplicate date, 6th rolls oldest, edit, delete, order', async () => {
  const t = tok.tess;
  for (const bad of [0, 46, 3.5, 'abc', null]) {
    const r = await api('POST', '/scores', { token: t, body: { value: bad, date: day(1) } });
    assert.equal(r.status, 400, `value ${bad}`);
  }
  let r = await api('POST', '/scores', { token: t, body: { value: 10, date: '2026-02-30' } });
  assert.equal(r.status, 400);
  r = await api('POST', '/scores', { token: t, body: { value: 10 } });
  assert.equal(r.status, 400);
  r = await api('POST', '/scores', { token: t, body: { value: 10, date: '2999-01-01' } });
  assert.equal(r.status, 400);

  const ids = [];
  for (let i = 5; i >= 1; i--) {
    r = await api('POST', '/scores', { token: t, body: { value: 10 + i, date: day(i * 2) } });
    assert.equal(r.status, 201);
    ids.push(r.data.score.id);
  }
  r = await api('POST', '/scores', { token: t, body: { value: 40, date: day(2) } });
  assert.equal(r.status, 409, 'duplicate date rejected');

  r = await api('POST', '/scores', { token: t, body: { value: 44, date: day(0) } });
  assert.equal(r.status, 201);
  assert.equal(r.data.removedIds.length, 1);
  r = await api('GET', '/scores', { token: t });
  assert.equal(r.data.items.length, 5);
  assert.equal(r.data.items[0].value, 44, 'newest first');
  assert.ok(!r.data.items.some((s) => s.id === ids[0]), 'oldest removed');
  const dates = r.data.items.map((s) => s.date);
  assert.deepEqual(dates, [...dates].sort().reverse());

  // older than all stored -> rejected
  r = await api('POST', '/scores', { token: t, body: { value: 9, date: day(200) } });
  assert.equal(r.status, 400);

  const target = r.data && (await api('GET', '/scores', { token: t })).data.items[1];
  r = await api('PUT', `/scores/${target.id}`, { token: t, body: { value: 30 } });
  assert.equal(r.data.score.value, 30);
  r = await api('PUT', `/scores/${target.id}`, { token: t, body: { value: 99 } });
  assert.equal(r.status, 400);
  const first = (await api('GET', '/scores', { token: t })).data.items[0];
  r = await api('PUT', `/scores/${target.id}`, { token: t, body: { date: first.date } });
  assert.equal(r.status, 409);
  r = await api('DELETE', `/scores/${target.id}`, { token: t });
  assert.equal(r.status, 200);
  r = await api('DELETE', `/scores/${target.id}`, { token: t });
  assert.equal(r.status, 404);
  // cannot touch another user's score
  const other = (await api('GET', '/admin/users', { token: tok.admin })).data.items.find((u) => u.email === 'aria@digitalheroes.demo');
  const otherScore = (await api('GET', `/admin/users/${other._id}`, { token: tok.admin })).data.scores[0];
  r = await api('DELETE', `/scores/${otherScore.id}`, { token: t });
  assert.equal(r.status, 404);
});

test('charities: directory, search, filter, detail, select, percentage, donation', async () => {
  let r = await api('GET', '/charities');
  assert.ok(r.data.items.length >= 6);
  assert.ok(r.data.categories.includes('Health'));
  r = await api('GET', '/charities?search=water');
  assert.equal(r.data.items.length, 1);
  r = await api('GET', '/charities?category=Education');
  assert.equal(r.data.items.length, 1);
  r = await api('GET', '/charities?featured=true');
  assert.equal(r.data.items[0].name, 'Clean Water Collective');
  const id = r.data.items[0]._id;
  r = await api('GET', `/charities/${id}`);
  assert.ok(r.data.charity.events.length > 0);
  r = await api('GET', '/charities/notanid');
  assert.equal(r.status, 400);
  r = await api('GET', '/charities/64b000000000000000000000');
  assert.equal(r.status, 404);

  r = await api('PUT', '/user/charity', { token: tok.tess, body: { charityPercent: 5 } });
  assert.equal(r.status, 400, 'below 10% minimum');
  r = await api('PUT', '/user/charity', { token: tok.tess, body: { charityId: id, charityPercent: 25 } });
  assert.equal(r.data.user.charityPercent, 25);
  r = await api('PUT', '/user/charity', { token: tok.tess, body: { charityId: '64b000000000000000000000' } });
  assert.equal(r.status, 400, 'missing charity');
  r = await api('POST', '/donations', { token: tok.tess, body: { charityId: id, amountCents: 500 } });
  assert.equal(r.status, 201);
  r = await api('POST', '/donations', { token: tok.tess, body: { charityId: id, amountCents: 5 } });
  assert.equal(r.status, 400);
});

test('dashboard aggregates every module', async () => {
  const r = await api('GET', '/user/dashboard', { token: tok.tess });
  assert.equal(r.status, 200);
  const d = r.data;
  assert.equal(d.subscription.isActive, true);
  assert.equal(d.scores.length, 4);
  assert.equal(d.charityPercent, 25);
  assert.ok(d.charity.name);
  assert.ok(d.draws.upcoming.length >= 1);
  assert.equal(d.contributions.donationCents, 500);
  assert.ok(d.contributions.subscriptionCents > 0);
});

test('draw math: prize pool split, equal winners, jackpot rollover', () => {
  const e = require('../src/utils/drawEngine');
  const { tiers, rolloverOutCents } = e.computeTiers(10000, 0, { 5: 0, 4: 2, 3: 5 });
  assert.equal(tiers.find((t) => t.match === 5).poolCents, 4000);
  assert.equal(tiers.find((t) => t.match === 4).prizeEachCents, 1750);
  assert.equal(tiers.find((t) => t.match === 3).prizeEachCents, 500);
  assert.equal(rolloverOutCents, 4000);
  const r2 = e.computeTiers(10000, 4000, { 5: 1, 4: 0, 3: 0 });
  assert.equal(r2.tiers[0].prizeEachCents, 8000);
  assert.equal(r2.rolloverOutCents, 0);
  assert.equal(e.countMatches([1, 2, 3, 3, 4], [3, 4, 9, 10, 11]), 2);
  const nums = e.randomNumbers();
  assert.equal(new Set(nums).size, 5);
  const w = e.weightedNumbers(new Map([[7, 1000]]));
  assert.ok(w.includes(7));
  assert.equal(e.poolFromSubscriptions([{ amountCents: 1000, plan: 'monthly' }, { amountCents: 12000, plan: 'yearly' }]), 1000);
});

test('draws: seeded published draw is public, upcoming numbers hidden', async () => {
  let r = await api('GET', '/draws');
  assert.equal(r.data.published.length, 1);
  assert.equal(r.data.published[0].numbers.length, 5);
  assert.ok(r.data.upcoming.length >= 1);
  assert.deepEqual(r.data.upcoming[0].numbers, []);
  r = await api('GET', `/draws/${r.data.published[0].id}`);
  assert.equal(r.data.draw.status, 'published');
});

test('admin draw flow: simulate -> publish -> duplicate publish rejected -> rollover', async () => {
  const a = tok.admin;
  let r = await api('POST', '/admin/draws/publish', { token: a, body: { month: '2030-01' } });
  assert.equal(r.status, 404);
  r = await api('POST', '/admin/draws/simulate', { token: a, body: { mode: 'bogus' } });
  assert.equal(r.status, 400);
  r = await api('POST', '/admin/draws/simulate', { token: tok.tess, body: {} });
  assert.equal(r.status, 403);

  // Rig: numbers no one can match -> jackpot rolls over; random then algorithmic
  r = await api('POST', '/admin/draws/simulate', { token: a, body: { mode: 'algorithmic' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.draw.status, 'simulated');
  assert.equal(r.data.draw.numbers.length, 5);
  r = await api('POST', '/admin/draws/simulate', { token: a, body: { mode: 'random' } });
  const draw = r.data.draw;
  const { Draw, Winner } = require('../src/models');
  await Draw.updateOne({ _id: draw.id }, { numbers: [1, 2, 3, 4, 5] });
  const before = await Winner.countDocuments();
  r = await api('POST', '/admin/draws/publish', { token: a, body: { drawId: draw.id } });
  assert.equal(r.status, 200);
  assert.equal(r.data.draw.status, 'published');
  assert.equal(r.data.draw.rolloverOutCents, r.data.draw.tiers.find((t) => t.match === 5).poolCents, 'jackpot rolled over');
  assert.ok((await Winner.countDocuments()) >= before);
  r = await api('POST', '/admin/draws/publish', { token: a, body: { drawId: draw.id } });
  assert.equal(r.status, 409);
  r = await api('POST', '/admin/draws/simulate', { token: a, body: { month: draw.month } });
  assert.equal(r.status, 409);

  // next upcoming draw carries the jackpot
  r = await api('POST', '/admin/draws/simulate', { token: a, body: {} });
  assert.ok(r.data.draw.rolloverInCents > 0);
  assert.equal(r.data.draw.totalPrizePoolCents, r.data.draw.poolCents + r.data.draw.rolloverInCents);
});

test('winner flow: proof upload -> reject -> re-upload -> approve -> paid', async () => {
  const demo = (await api('POST', '/auth/login', { body: { email: 'user@digitalheroes.demo', password: 'User@12345' } })).data.token;
  let r = await api('GET', '/user/winnings', { token: demo });
  assert.equal(r.data.items.length, 1);
  const w = r.data.items[0];
  assert.equal(w.matchType, 3);
  assert.equal(w.verificationStatus, 'awaiting_proof');
  assert.ok(r.data.totalWonCents > 0);

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  const upload = (buf, type = 'image/png', name = 'p.png') => {
    const f = new FormData();
    f.append('proof', new Blob([buf], { type }), name);
    return api('POST', `/user/winnings/${w.id}/proof`, { token: demo, form: f });
  };
  r = await upload(Buffer.from('not an image at all, just text'), 'text/plain', 'x.txt');
  assert.equal(r.status, 400);
  r = await upload(Buffer.alloc(3 * 1024 * 1024, 1));
  assert.equal(r.status, 400);
  r = await upload(png);
  assert.equal(r.status, 201);
  assert.equal(r.data.winner.verificationStatus, 'pending');
  r = await upload(png);
  assert.equal(r.status, 409);
  r = await api('GET', `/winners/${w.id}/proof`, { token: demo });
  assert.equal(r.status, 200);
  assert.ok(Buffer.isBuffer(r.data));
  r = await api('GET', `/winners/${w.id}/proof`, { token: tok.tess });
  assert.equal(r.status, 403);

  const a = tok.admin;
  r = await api('PUT', `/admin/winners/${w.id}/payout`, { token: a });
  assert.equal(r.status, 400, 'cannot pay before approval');
  r = await api('PUT', `/admin/winners/${w.id}/verify`, { token: a, body: { action: 'reject' } });
  assert.equal(r.status, 400, 'reject needs a reason');
  r = await api('PUT', `/admin/winners/${w.id}/verify`, { token: a, body: { action: 'reject', note: 'Scores not visible' } });
  assert.equal(r.data.winner.verificationStatus, 'rejected');
  r = await upload(png);
  assert.equal(r.status, 201, 're-upload after rejection');
  r = await api('GET', '/admin/winners?status=pending', { token: a });
  assert.equal(r.data.items.length, 1);
  r = await api('PUT', `/admin/winners/${w.id}/verify`, { token: a, body: { action: 'approve' } });
  assert.equal(r.data.winner.verificationStatus, 'approved');
  r = await api('PUT', `/admin/winners/${w.id}/payout`, { token: a });
  assert.equal(r.data.winner.paymentStatus, 'paid');
  r = await api('PUT', `/admin/winners/${w.id}/payout`, { token: a });
  assert.equal(r.status, 409);
  r = await api('GET', '/user/dashboard', { token: demo });
  assert.equal(r.data.winnings.paidCents, r.data.winnings.totalWonCents);
});

test('admin: user management, scores, subscription override, charities CRUD, reports', async () => {
  const a = tok.admin;
  const list = (await api('GET', '/admin/users?search=ben', { token: a })).data;
  assert.equal(list.items.length, 1);
  const ben = list.items[0];
  let r = await api('PUT', `/admin/users/${ben._id}`, { token: a, body: { name: 'Ben C.', subscription: { status: 'cancelled' } } });
  assert.equal(r.data.user.name, 'Ben C.');
  assert.equal(r.data.subscription.status, 'cancelled');
  r = await api('PUT', `/admin/users/${ben._id}`, { token: a, body: { subscription: { extendMonths: 2 } } });
  assert.equal(r.data.subscription.status, 'active');
  r = await api('POST', `/admin/users/${ben._id}/scores`, { token: a, body: { value: 33, date: day(0) } });
  assert.equal(r.status, 201);
  r = await api('PUT', `/admin/users/${ben._id}/scores/${r.data.score.id}`, { token: a, body: { value: 34 } });
  assert.equal(r.data.score.value, 34);
  const adminUser = (await api('GET', '/admin/users?role=admin', { token: a })).data.items[0];
  r = await api('PUT', `/admin/users/${adminUser._id}`, { token: a, body: { role: 'user' } });
  assert.equal(r.status, 400, 'cannot demote self');

  r = await api('POST', '/admin/charities', { token: a, body: { name: 'Test Cause', category: 'Health', events: [{ title: 'Gala', date: '2030-05-01' }] } });
  assert.equal(r.status, 201);
  const cid = r.data.charity._id;
  r = await api('POST', '/admin/charities', { token: a, body: { name: 'Test Cause' } });
  assert.equal(r.status, 409);
  r = await api('POST', '/admin/charities', { token: a, body: {} });
  assert.equal(r.status, 400);
  r = await api('PUT', `/admin/charities/${cid}`, { token: a, body: { featured: true, description: 'Updated' } });
  assert.equal(r.data.charity.featured, true);
  assert.equal((await api('GET', '/charities?featured=true')).data.items.length, 1, 'single featured');
  r = await api('DELETE', `/admin/charities/${cid}`, { token: a });
  assert.equal(r.data.deleted, true);
  const inUse = (await api('GET', '/charities')).data.items.find((c) => c.name === 'Bright Futures Education');
  r = await api('DELETE', `/admin/charities/${inUse._id}`, { token: a });
  assert.equal(r.data.deactivated, true);

  r = await api('GET', '/admin/reports', { token: a });
  assert.ok(r.data.totalUsers >= 9);
  assert.ok(r.data.charity.totalCents > 0);
  assert.ok(r.data.draws.published >= 2);
  assert.ok(r.data.winners.count >= 1);
});

test('error handling: malformed json, unknown route', async () => {
  let res = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
  assert.equal(res.status, 400);
  res = await fetch(base + '/nope');
  assert.equal(res.status, 404);
});
