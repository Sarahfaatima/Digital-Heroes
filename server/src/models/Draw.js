const mongoose = require('mongoose');

const tierSchema = new mongoose.Schema({
  _id: false,
  match: Number,
  sharePercent: Number,
  poolCents: Number, // tier pool (the jackpot tier includes rollover)
  winnerCount: Number,
  prizeEachCents: Number,
});

const drawSchema = new mongoose.Schema(
  {
    month: { type: String, required: true, unique: true, match: /^\d{4}-\d{2}$/ }, // one draw per month
    title: String,
    mode: { type: String, enum: ['random', 'algorithmic'], default: 'random' },
    status: { type: String, enum: ['draft', 'simulated', 'published'], default: 'draft', index: true },
    numbers: [Number],
    activeSubscribers: { type: Number, default: 0 },
    participants: { type: Number, default: 0 },
    poolCents: { type: Number, default: 0 }, // fresh pool from this month's subscriptions
    rolloverInCents: { type: Number, default: 0 },
    rolloverOutCents: { type: Number, default: 0 },
    tiers: [tierSchema],
    simulatedAt: Date,
    publishedAt: Date,
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Draw', drawSchema);
