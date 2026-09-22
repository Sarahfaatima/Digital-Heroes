/**
 * Seed demo data. Usage: `npm run seed` (wipes the target database first).
 * Also exported as a function for tests and the in-memory dev runner.
 */
const bcrypt = require('bcrypt');
const models = require('../models');
const { Charity, User, Score } = models;
const subscriptionService = require('../services/subscriptionService');
const drawService = require('../services/drawService');
const winnerService = require('../services/winnerService');
const { monthKey } = require('../utils/helpers');

const DEMO = {
  admin: { name: 'Demo Admin', email: 'admin@digitalheroes.demo', password: 'Admin@12345' },
  user: { name: 'Demo Subscriber', email: 'user@digitalheroes.demo', password: 'User@12345' },
};

const img = (seed) => `https://picsum.photos/seed/${seed}/900/560`;
const inDays = (n) => new Date(Date.now() + n * 86400000);
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

const CHARITIES = [
  {
    name: 'Clean Water Collective',
    category: 'Health',
    featured: true,
    shortDescription: 'Bringing safe drinking water to rural communities.',
    description:
      'Clean Water Collective builds wells and filtration systems in villages where families walk hours for water. Every 10 subscribers fund a community tap that serves 300 people for life. Our teams train local technicians so each project is maintained by the community it serves.',
    imageUrl: img('clean-water'),
    website: 'https://example.org/clean-water',
    events: [
      { title: 'Charity Golf Day', date: inDays(21), location: 'Riverside Club', description: 'A friendly 18-hole day; all green fees go to new wells.' },
      { title: 'Well-Build Fundraiser Dinner', date: inDays(48), location: 'Grand Hall, City Centre', description: 'Dinner and talks from our field engineers.' },
    ],
  },
  {
    name: 'Bright Futures Education',
    category: 'Education',
    shortDescription: 'Scholarships and school supplies for children in need.',
    description:
      'Bright Futures funds scholarships, books and meals so that no child leaves school because of cost. We partner with 40 schools and track each scholar until graduation.',
    imageUrl: img('bright-futures'),
    website: 'https://example.org/bright-futures',
    events: [{ title: 'Scholars Showcase Day', date: inDays(35), location: 'Community Arena', description: 'Meet the students your subscription supports.' }],
  },
  {
    name: 'Wild Roots Conservation',
    category: 'Environment',
    shortDescription: 'Restoring forests and protecting endangered wildlife.',
    description:
      'Wild Roots plants native trees, restores wildlife corridors and employs local rangers. One subscriber-year plants around 60 trees.',
    imageUrl: img('wild-roots'),
    website: 'https://example.org/wild-roots',
    events: [{ title: 'Tree-Planting Weekend', date: inDays(14), location: 'Oak Valley Reserve', description: 'Volunteer planting event for all ages.' }],
  },
  {
    name: 'Mindful Minds Foundation',
    category: 'Mental Health',
    shortDescription: 'Free counselling and peer support for young people.',
    description: 'Mindful Minds offers free counselling sessions, helplines and school programmes so that nobody faces a hard time alone.',
    imageUrl: img('mindful-minds'),
    website: 'https://example.org/mindful-minds',
    events: [{ title: 'Walk & Talk Golf Morning', date: inDays(28), location: 'Hillcrest Park', description: 'An informal morning to raise awareness.' }],
  },
  {
    name: 'Second Serve Veterans',
    category: 'Community',
    shortDescription: 'Sport-based recovery programmes for veterans.',
    description: 'Second Serve gives veterans access to sport, coaching and community as part of recovery and reintegration.',
    imageUrl: img('second-serve'),
    website: 'https://example.org/second-serve',
    events: [],
  },
  {
    name: 'Paws & Hearts Rescue',
    category: 'Animals',
    shortDescription: 'Rescue, rehabilitation and rehoming for abandoned animals.',
    description: 'Paws & Hearts runs three shelters, a veterinary clinic and a foster network that has rehomed over 8,000 animals.',
    imageUrl: img('paws-hearts'),
    website: 'https://example.org/paws-hearts',
    events: [{ title: 'Adoption & Putting Day', date: inDays(60), location: 'Meadow Shelter', description: 'Family day with adoption stands.' }],
  },
];

async function makeUser({ name, email, password, role = 'user', charity, charityPercent = 10 }) {
  return User.create({ name, email, role, charity, charityPercent, passwordHash: await bcrypt.hash(password, 10) });
}

async function addScores(userId, values) {
  const docs = values.map((value, i) => ({ user: userId, value, date: new Date(`${daysAgo(i * 3 + 1)}T00:00:00Z`) }));
  await Score.insertMany(docs);
}

async function seed({ log = console.log } = {}) {
  await Promise.all(Object.values(models).map((m) => m.deleteMany({})));
  await Promise.all(Object.values(models).map((m) => m.syncIndexes()));

  const charities = await Charity.insertMany(CHARITIES);
  const [water, education, wild, mind] = charities;

  await makeUser({ ...DEMO.admin, role: 'admin' });
  const demo = await makeUser({ ...DEMO.user, charity: water._id, charityPercent: 15 });
  await subscriptionService.activate(demo._id, { plan: 'monthly' });
  await addScores(demo._id, [32, 28, 36, 30, 25]);

  // Extra subscribers so pools, draws and reports have realistic data
  const extras = [
    ['Aria Patel', 'aria@digitalheroes.demo', education, 'yearly', [22, 30, 33, 28, 41]],
    ['Ben Carter', 'ben@digitalheroes.demo', wild, 'monthly', [18, 24, 30, 36, 40]],
    ['Chloe Nguyen', 'chloe@digitalheroes.demo', mind, 'monthly', [35, 33, 31, 29, 27]],
    ['Dev Sharma', 'dev@digitalheroes.demo', water, 'yearly', [12, 20, 28, 34, 42]],
    ['Elena Rossi', 'elena@digitalheroes.demo', wild, 'monthly', [26, 26 + 1, 38, 21, 19]],
    ['Farid Khan', 'farid@digitalheroes.demo', education, 'monthly', [15, 23, 31, 39, 44]],
  ];
  const created = [];
  for (const [name, email, charity, plan, scores] of extras) {
    const u = await makeUser({ name, email, password: 'User@12345', charity: charity._id, charityPercent: 10 + Math.floor(Math.random() * 3) * 5 });
    await subscriptionService.activate(u._id, { plan });
    await addScores(u._id, scores);
    created.push(u);
  }
  // a lapsed subscriber and a never-subscribed user for the admin views
  const lapsed = await makeUser({ name: 'Grace Lapsed', email: 'grace@digitalheroes.demo', password: 'User@12345', charity: mind._id });
  await subscriptionService.activate(lapsed._id, { plan: 'monthly' });
  await models.Subscription.updateOne({ user: lapsed._id }, { status: 'lapsed', currentPeriodEnd: inDays(-3) });
  await makeUser({ name: 'Hugo Visitor', email: 'hugo@digitalheroes.demo', password: 'User@12345', charity: water._id });

  // Example published draw for LAST month, rigged so the demo user is a 3-match winner
  const now = new Date();
  const prev = monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
  await drawService.simulate({ month: prev, mode: 'random' });
  await models.Draw.updateOne({ month: prev }, { numbers: [3, 25, 30, 32, 44] }); // demo user holds 25, 30, 32 => 3 matches
  const published = await drawService.publish({ month: prev }, (await User.findOne({ role: 'admin' }))._id);

  // Give the seeded win a submitted proof so the admin queue is not empty on first login
  const win = await models.Winner.findOne({ draw: published.draw.id });
  if (win) log(`Seeded winner: ${win.matchType}-match awaiting proof`);

  // Upcoming draw (current month) exists for the dashboard
  await drawService.ensureUpcomingDraw();
  await models.Contribution.create({ user: demo._id, charity: water._id, type: 'donation', amountCents: 2500, note: 'Independent donation' });

  log('Seed complete.');
  log(`  Admin: ${DEMO.admin.email} / ${DEMO.admin.password}`);
  log(`  User:  ${DEMO.user.email} / ${DEMO.user.password}`);
  return { demoUserId: demo._id };
}

module.exports = { seed, DEMO };

if (require.main === module) {
  const config = require('../config');
  const { connectDb } = require('../config/db');
  if (config.isProd && process.env.SEED_FORCE !== 'true') {
    console.error('Refusing to wipe a production database. Set SEED_FORCE=true to override.');
    process.exit(1);
  }
  connectDb()
    .then(() => seed())
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
