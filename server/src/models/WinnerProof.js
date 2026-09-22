const mongoose = require('mongoose');

// Proof screenshots live in MongoDB so the app works on ephemeral hosts (no disk needed).
const winnerProofSchema = new mongoose.Schema(
  {
    winner: { type: mongoose.Schema.Types.ObjectId, ref: 'Winner', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    filename: String,
    contentType: { type: String, required: true },
    size: Number,
    data: { type: Buffer, required: true, select: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('WinnerProof', winnerProofSchema);
