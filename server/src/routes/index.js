const express = require('express');
const multer = require('multer');
const rules = require('../config/businessRules');
const c = require('../controllers');
const { authenticate, requireAdmin, requireActiveSubscription } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: rules.winners.maxProofBytes, files: 1 } });

const router = express.Router();

router.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
router.get('/config', (req, res) =>
  res.json({ currency: rules.currency, plans: rules.plans, scores: rules.scores, charity: rules.charity, prizePool: rules.prizePool, draw: rules.draw })
);

// Auth
router.post('/auth/register', c.auth.register);
router.post('/auth/login', c.auth.login);
router.post('/auth/logout', authenticate, c.auth.logout);
router.get('/auth/me', authenticate, c.auth.me);

// Public
router.get('/charities', c.charities.list);
router.get('/charities/:id', c.charities.get);
router.get('/draws', c.draws.list);
router.get('/draws/:id', c.draws.get);

// Authenticated user
router.get('/scores', authenticate, c.scores.list);
router.post('/scores', authenticate, requireActiveSubscription, c.scores.create);
router.put('/scores/:id', authenticate, requireActiveSubscription, c.scores.update);
router.delete('/scores/:id', authenticate, requireActiveSubscription, c.scores.remove);

router.get('/subscription', authenticate, c.subscription.get);
router.post('/subscription', authenticate, c.subscription.activate);
router.post('/subscription/cancel', authenticate, c.subscription.cancel);

router.get('/user/dashboard', authenticate, c.user.dashboard);
router.get('/user/profile', authenticate, c.user.profile);
router.put('/user/profile', authenticate, c.user.updateProfile);
router.put('/user/charity', authenticate, c.user.setCharity);
router.get('/user/draws', authenticate, c.user.draws);
router.get('/user/winnings', authenticate, c.user.winnings);
router.post('/user/winnings/:id/proof', authenticate, upload.single('proof'), c.user.uploadProof);
router.post('/donations', authenticate, c.charities.donate);
router.get('/winners/:id/proof', authenticate, c.winners.proof);

// Admin
const admin = express.Router();
admin.use(authenticate, requireAdmin);
admin.get('/users', c.admin.users);
admin.get('/users/:id', c.admin.user);
admin.put('/users/:id', c.admin.updateUser);
admin.post('/users/:id/scores', c.admin.addScore);
admin.put('/users/:id/scores/:scoreId', c.admin.updateScore);
admin.delete('/users/:id/scores/:scoreId', c.admin.deleteScore);

admin.get('/charities', c.admin.charities);
admin.post('/charities', c.admin.createCharity);
admin.put('/charities/:id', c.admin.updateCharity);
admin.delete('/charities/:id', c.admin.deleteCharity);

admin.get('/draws', c.admin.draws);
admin.post('/draws/simulate', c.admin.simulate);
admin.post('/draws/publish', c.admin.publish);

admin.get('/winners', c.admin.winners);
admin.put('/winners/:id/verify', c.admin.verify);
admin.put('/winners/:id/payout', c.admin.payout);

admin.get('/reports', c.admin.reports);
router.use('/admin', admin);

module.exports = router;
