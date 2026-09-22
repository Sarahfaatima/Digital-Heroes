const mongoose = require('mongoose');
const rules = require('../config/businessRules');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user', index: true },
    charity: { type: mongoose.Schema.Types.ObjectId, ref: 'Charity', default: null },
    charityPercent: {
      type: Number,
      default: rules.charity.defaultPercent,
      min: rules.charity.minPercent,
      max: rules.charity.maxPercent,
    },
    phone: { type: String, trim: true, maxlength: 30 },
    country: { type: String, trim: true, maxlength: 60 },
    isBlocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userSchema.methods.toSafe = function toSafe() {
  const o = this.toObject();
  delete o.passwordHash;
  delete o.__v;
  return o;
};

module.exports = mongoose.model('User', userSchema);
