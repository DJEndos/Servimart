const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema(
  {
    provider: { type: mongoose.Schema.Types.ObjectId, ref: 'ProviderProfile', required: true },
    distanceMeters: { type: Number, required: true },
    notifiedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['notified', 'accepted', 'declined', 'timed_out'],
      default: 'notified',
    },
  },
  { _id: false }
);

const serviceRequestSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    city: { type: String, required: true },
    description: { type: String, required: true, trim: true },
    photoUrl: { type: String },

    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [longitude, latitude]
    },

    // Every provider considered, in ranked order, for audit + fallback if the top pick declines
    candidateProviders: [candidateSchema],
    assignedProvider: { type: mongoose.Schema.Types.ObjectId, ref: 'ProviderProfile' },

    status: {
      type: String,
      enum: [
        'pending_match', // just posted, matching engine running
        'awaiting_acceptance', // pushed to candidates, waiting on a response
        'accepted', // a provider accepted, job scheduled
        'in_progress',
        'completed',
        'cancelled',
        'disputed',
      ],
      default: 'pending_match',
    },

    price: { type: Number }, // agreed or quoted amount, in kobo
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'held', 'released', 'refunded'],
      default: 'unpaid',
    },
    paystackReference: { type: String },
  },
  { timestamps: true }
);

serviceRequestSchema.index({ location: '2dsphere' });
serviceRequestSchema.index({ city: 1, status: 1 });

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema);
