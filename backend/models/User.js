const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['admin', 'customer', 'provider'],
      required: true,
      default: 'customer',
    },
    city: { type: String, required: true, trim: true }, // e.g. "Port Harcourt", "Lagos", "Abuja"
    isActive: { type: Boolean, default: true }, // admin can deactivate/ban
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
