const mongoose = require('mongoose');

const winnerSchema = new mongoose.Schema(
  {
    draw: { type: mongoose.Schema.Types.ObjectId, ref: 'Draw', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    matchType: { type: Number, enum: [3, 4, 5], required: true },
    prizeCents: { type: Number, required: true, min: 0 },
    // awaiting_proof -> pending (proof uploaded) -> approved | rejected (a rejected winner may re-upload)
    verificationStatus: {
      type: String,
      enum: ['awaiting_proof', 'pending', 'approved', 'rejected'],
      default: 'awaiting_proof',
      index: true,
    },
    // pending -> paid (only possible after approval)
    paymentStatus: { type: String, enum: ['pending', 'paid'], default: 'pending' },
    adminNote: { type: String, trim: true, maxlength: 500 },
    reviewedAt: Date,
    paidAt: Date,
    latestProof: { type: mongoose.Schema.Types.ObjectId, ref: 'WinnerProof' },
  },
  { timestamps: true }
);
winnerSchema.index({ draw: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('Winner', winnerSchema);
