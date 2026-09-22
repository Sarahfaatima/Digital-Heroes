const rules = require('../config/businessRules');
const { Winner, WinnerProof } = require('../models');
const { bad, notFound, forbidden, conflict } = require('../utils/AppError');
const { assertObjectId, escapeRegex } = require('../utils/helpers');

const present = (w) => ({
  id: w._id,
  draw: w.draw && w.draw.month ? { id: w.draw._id, month: w.draw.month, title: w.draw.title, numbers: w.draw.numbers } : w.draw,
  user: w.user && w.user.email ? { id: w.user._id, name: w.user.name, email: w.user.email } : w.user,
  matchType: w.matchType,
  prizeCents: w.prizeCents,
  verificationStatus: w.verificationStatus,
  paymentStatus: w.paymentStatus,
  hasProof: !!w.latestProof,
  adminNote: w.adminNote,
  reviewedAt: w.reviewedAt,
  paidAt: w.paidAt,
  createdAt: w.createdAt,
});

async function listMine(userId) {
  const rows = await Winner.find({ user: userId }).populate('draw', 'month title numbers').sort({ createdAt: -1 });
  const items = rows.map(present);
  const totalWonCents = items.reduce((s, w) => s + w.prizeCents, 0);
  const paidCents = items.filter((w) => w.paymentStatus === 'paid').reduce((s, w) => s + w.prizeCents, 0);
  return { items, totalWonCents, paidCents, pendingCents: totalWonCents - paidCents };
}

/** Sniff magic bytes so a renamed .exe cannot be uploaded as an image. */
function detectImageType(buf) {
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}

async function uploadProof(userId, winnerId, file) {
  assertObjectId(winnerId, 'winner id');
  const winner = await Winner.findById(winnerId);
  if (!winner || winner.user.toString() !== userId.toString()) throw notFound('Winning record not found');
  if (!file) throw bad('Please attach a screenshot (field name: proof)');
  if (file.size > rules.winners.maxProofBytes) throw bad('Proof image must be 2MB or smaller');
  const type = detectImageType(file.buffer);
  if (!type || !rules.winners.allowedProofTypes.includes(type)) throw bad('Proof must be a PNG, JPEG or WebP image');
  if (winner.verificationStatus === 'approved') throw conflict('This win has already been approved');
  if (winner.verificationStatus === 'pending') throw conflict('A proof is already awaiting review');

  const proof = await WinnerProof.create({
    winner: winner._id,
    user: userId,
    filename: String(file.originalname || 'proof').slice(0, 120),
    contentType: type,
    size: file.size,
    data: file.buffer,
  });
  winner.latestProof = proof._id;
  winner.verificationStatus = 'pending';
  winner.adminNote = undefined;
  await winner.save();
  return present(winner);
}

async function getProofFile(requester, winnerId) {
  assertObjectId(winnerId, 'winner id');
  const winner = await Winner.findById(winnerId);
  if (!winner) throw notFound('Winning record not found');
  if (requester.role !== 'admin' && winner.user.toString() !== requester.id) throw forbidden('You cannot view this proof');
  if (!winner.latestProof) throw notFound('No proof uploaded');
  const proof = await WinnerProof.findById(winner.latestProof).select('+data');
  if (!proof) throw notFound('No proof uploaded');
  return proof;
}

async function adminList({ status, payment, search } = {}) {
  const q = {};
  if (status) q.verificationStatus = status;
  if (payment) q.paymentStatus = payment;
  let rows = await Winner.find(q).populate('user', 'name email').populate('draw', 'month title numbers').sort({ createdAt: -1 }).limit(500);
  if (search) {
    const re = new RegExp(escapeRegex(search), 'i');
    rows = rows.filter((w) => w.user && (re.test(w.user.name) || re.test(w.user.email)));
  }
  return rows.map(present);
}

async function verify(winnerId, { action, note }) {
  assertObjectId(winnerId, 'winner id');
  if (!['approve', 'reject'].includes(action)) throw bad('action must be "approve" or "reject"');
  const w = await Winner.findById(winnerId);
  if (!w) throw notFound('Winner not found');
  if (w.verificationStatus !== 'pending') throw bad('Only winners with a submitted proof awaiting review can be verified');
  if (action === 'reject' && !(note && String(note).trim())) throw bad('Please give a reason when rejecting a proof');
  w.verificationStatus = action === 'approve' ? 'approved' : 'rejected';
  w.adminNote = note ? String(note).trim().slice(0, 500) : undefined;
  w.reviewedAt = new Date();
  await w.save();
  return present(await w.populate([{ path: 'user', select: 'name email' }, { path: 'draw', select: 'month title numbers' }]));
}

async function markPaid(winnerId) {
  assertObjectId(winnerId, 'winner id');
  const w = await Winner.findById(winnerId);
  if (!w) throw notFound('Winner not found');
  if (w.verificationStatus !== 'approved') throw bad('Only approved winners can be marked as paid');
  if (w.paymentStatus === 'paid') throw conflict('This winner is already marked as paid');
  w.paymentStatus = 'paid';
  w.paidAt = new Date();
  await w.save();
  return present(await w.populate([{ path: 'user', select: 'name email' }, { path: 'draw', select: 'month title numbers' }]));
}

module.exports = { listMine, uploadProof, getProofFile, adminList, verify, markPaid, present };
