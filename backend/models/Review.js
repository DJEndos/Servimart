const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    serviceRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceRequest', required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: mongoose.Schema.Types.ObjectId, ref: 'ProviderProfile', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Review', reviewSchema);
