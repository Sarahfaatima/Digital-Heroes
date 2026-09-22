/**
 * Thin controllers: parse the request, call a service, shape the response.
 * All business rules live in ../services.
 */
const asyncHandler = require('../utils/asyncHandler');
const auth = require('../services/authService');
const scores = require('../services/scoreService');
const subs = require('../services/subscriptionService');
const charities = require('../services/charityService');
const users = require('../services/userService');
const draws = require('../services/drawService');
const winners = require('../services/winnerService');
const admin = require('../services/adminService');
const { verifyToken } = auth;
const { User } = require('../models');

const h = asyncHandler;

exports.auth = {
  register: h(async (req, res) => res.status(201).json(await auth.register(req.body || {}))),
  login: h(async (req, res) => res.json(await auth.login(req.body || {}))),
  me: h(async (req, res) => res.json({ user: await users.getProfile(req.user._id), subscription: subs.present(req.subscription) })),
  logout: (req, res) => res.json({ message: 'Logged out' }), // JWTs are stateless; the client discards the token
};

exports.scores = {
  list: h(async (req, res) => res.json({ items: await scores.list(req.user._id) })),
  create: h(async (req, res) => res.status(201).json(await scores.add(req.user._id, req.body || {}))),
  update: h(async (req, res) => res.json({ score: await scores.update(req.user._id, req.params.id, req.body || {}) })),
  remove: h(async (req, res) => (await scores.remove(req.user._id, req.params.id), res.json({ message: 'Score deleted' }))),
};

exports.charities = {
  list: h(async (req, res) => res.json(await charities.listPublic(req.query))),
  get: h(async (req, res) => res.json({ charity: await charities.getPublic(req.params.id) })),
  donate: h(async (req, res) => res.status(201).json({ contribution: await charities.donate(req.user._id, req.body || {}) })),
};

exports.subscription = {
  get: h(async (req, res) => res.json({ subscription: await subs.get(req.user._id) })),
  activate: h(async (req, res) => res.status(201).json({ subscription: await subs.activate(req.user._id, req.body || {}) })),
  cancel: h(async (req, res) => res.json({ subscription: await subs.cancel(req.user._id) })),
};

exports.user = {
  dashboard: h(async (req, res) => res.json(await users.dashboard(req.user._id))),
  profile: h(async (req, res) => res.json({ user: await users.getProfile(req.user._id) })),
  updateProfile: h(async (req, res) => res.json({ user: await users.updateProfile(req.user._id, req.body || {}) })),
  setCharity: h(async (req, res) => res.json({ user: await users.setCharity(req.user._id, req.body || {}) })),
  draws: h(async (req, res) => res.json(await users.myDraws(req.user._id))),
  winnings: h(async (req, res) => res.json(await winners.listMine(req.user._id))),
  uploadProof: h(async (req, res) => res.status(201).json({ winner: await winners.uploadProof(req.user._id, req.params.id, req.file) })),
};

exports.draws = {
  list: h(async (req, res) => res.json(await draws.listPublic())),
  get: h(async (req, res) => {
    // Optional auth: personalise the response when a valid token is supplied
    let userId = null;
    const t = (req.headers.authorization || '').replace(/^Bearer /, '');
    if (t) {
      try {
        const u = await User.findById(verifyToken(t).sub).select('_id');
        userId = u && u._id;
      } catch {
        /* anonymous */
      }
    }
    res.json({ draw: await draws.getPublic(req.params.id, userId) });
  }),
};

exports.winners = {
  proof: h(async (req, res) => {
    const proof = await winners.getProofFile(req.user, req.params.id);
    res.set('Content-Type', proof.contentType).set('Cache-Control', 'private, max-age=300').send(proof.data);
  }),
};

exports.admin = {
  users: h(async (req, res) => res.json(await admin.listUsers(req.query))),
  user: h(async (req, res) => res.json(await admin.getUser(req.params.id))),
  updateUser: h(async (req, res) => res.json(await admin.updateUser(req.user._id, req.params.id, req.body || {}))),
  addScore: h(async (req, res) => res.status(201).json(await admin.addScore(req.params.id, req.body || {}))),
  updateScore: h(async (req, res) => res.json({ score: await admin.updateScore(req.params.id, req.params.scoreId, req.body || {}) })),
  deleteScore: h(async (req, res) => (await admin.deleteScore(req.params.id, req.params.scoreId), res.json({ message: 'Score deleted' }))),

  charities: h(async (req, res) => res.json({ items: await charities.adminList() })),
  createCharity: h(async (req, res) => res.status(201).json({ charity: await charities.create(req.body || {}) })),
  updateCharity: h(async (req, res) => res.json({ charity: await charities.update(req.params.id, req.body || {}) })),
  deleteCharity: h(async (req, res) => res.json(await charities.remove(req.params.id))),

  draws: h(async (req, res) => res.json({ items: await draws.adminList() })),
  simulate: h(async (req, res) => res.json(await draws.simulate(req.body || {}))),
  publish: h(async (req, res) => res.json(await draws.publish(req.body || {}, req.user._id))),

  winners: h(async (req, res) => res.json({ items: await winners.adminList(req.query) })),
  verify: h(async (req, res) => res.json({ winner: await winners.verify(req.params.id, req.body || {}) })),
  payout: h(async (req, res) => res.json({ winner: await winners.markPaid(req.params.id) })),

  reports: h(async (req, res) => res.json(await admin.reports())),
};
