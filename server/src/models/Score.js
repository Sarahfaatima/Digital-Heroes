const mongoose = require('mongoose');
const rules = require('../config/businessRules');

const scoreSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    value: { type: Number, required: true, min: rules.scores.min, max: rules.scores.max, validate: Number.isInteger },
    date: { type: Date, required: true }, // UTC midnight
  },
  { timestamps: true }
);

// PRD: only one score per date per user - enforced by the database, not only by code.
scoreSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Score', scoreSchema);
