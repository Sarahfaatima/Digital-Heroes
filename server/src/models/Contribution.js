const mongoose = require('mongoose');

// Money directed to a charity: either the charity share of a subscription payment or an independent donation.
const contributionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    charity: { type: mongoose.Schema.Types.ObjectId, ref: 'Charity', required: true, index: true },
    type: { type: String, enum: ['subscription', 'donation'], required: true },
    amountCents: { type: Number, required: true, min: 1 },
    percent: Number, // for subscription contributions
    note: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Contribution', contributionSchema);
