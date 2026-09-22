const mongoose = require('mongoose');

const charitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120, unique: true },
    shortDescription: { type: String, trim: true, maxlength: 240, default: '' },
    description: { type: String, trim: true, maxlength: 5000, default: '' },
    category: { type: String, trim: true, default: 'General', index: true },
    imageUrl: { type: String, trim: true, default: '' },
    gallery: [{ type: String, trim: true }],
    website: { type: String, trim: true, default: '' },
    featured: { type: Boolean, default: false, index: true },
    active: { type: Boolean, default: true },
    events: [
      {
        title: { type: String, required: true, trim: true },
        date: { type: Date, required: true },
        location: { type: String, trim: true },
        description: { type: String, trim: true },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Charity', charitySchema);
