const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    plan: { type: String, enum: ['monthly', 'yearly'], required: true },
    // active: paid and in period | cancelled: user cancelled | lapsed: period ended unpaid | inactive: never subscribed
    status: { type: String, enum: ['active', 'cancelled', 'lapsed', 'inactive'], default: 'inactive', index: true },
    amountCents: { type: Number, required: true, min: 0 },
    startedAt: Date,
    currentPeriodStart: Date,
    currentPeriodEnd: { type: Date, index: true },
    cancelledAt: Date,
    provider: { type: String, default: 'demo' },
    providerRef: String,
    lastPaymentStatus: { type: String, enum: ['none', 'succeeded', 'failed', 'refunded'], default: 'none' },
    lastPaymentAt: Date,
    payments: [
      {
        _id: false,
        at: { type: Date, default: Date.now },
        amountCents: Number,
        plan: String,
        status: String,
        ref: String,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Subscription', subscriptionSchema);
