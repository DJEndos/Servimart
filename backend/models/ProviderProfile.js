const mongoose = require('mongoose');

const providerProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true }],
    city: { type: String, required: true },

    // GeoJSON Point - required for $near / $geoNear queries
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] }, // [longitude, latitude]
    },
    locationUpdatedAt: { type: Date },

    available: { type: Boolean, default: false }, // toggled by provider; false while offline
    verified: { type: Boolean, default: false }, // set true by admin after ID/trade check
    verificationDocs: [{ type: String }], // uploaded doc URLs, reviewed by admin

    // Trust signals used to rank matches, not just raw distance
    ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0 },
    jobsCompleted: { type: Number, default: 0 },
    jobsOffered: { type: Number, default: 0 }, // times a request was pushed to this provider
    jobsAccepted: { type: Number, default: 0 }, // used to derive acceptanceRate

    bankAccountNumber: { type: String }, // for Paystack transfer/payout
    bankCode: { type: String },
  },
  { timestamps: true }
);

// Required for $near / $geoNear geospatial queries
providerProfileSchema.index({ location: '2dsphere' });
// Speeds up the common matching filter: same city, category, available, verified
providerProfileSchema.index({ city: 1, categories: 1, available: 1, verified: 1 });

providerProfileSchema.virtual('acceptanceRate').get(function () {
  if (!this.jobsOffered) return 0;
  return this.jobsAccepted / this.jobsOffered;
});

module.exports = mongoose.model('ProviderProfile', providerProfileSchema);
