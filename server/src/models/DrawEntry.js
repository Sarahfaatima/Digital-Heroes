const mongoose = require('mongoose');

// Snapshot of a subscriber's participation in a published draw.
const drawEntrySchema = new mongoose.Schema(
  {
    draw: { type: mongoose.Schema.Types.ObjectId, ref: 'Draw', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    scores: [Number],
    matches: { type: Number, default: 0 },
  },
  { timestamps: true }
);
drawEntrySchema.index({ draw: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('DrawEntry', drawEntrySchema);
