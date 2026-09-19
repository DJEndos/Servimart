const express = require('express');
const User = require('../models/User');
const ProviderProfile = require('../models/ProviderProfile');
const Category = require('../models/Category');
const ServiceRequest = require('../models/ServiceRequest');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

// Providers awaiting ID/trade verification before they can go available
router.get('/providers/pending', async (req, res) => {
  const pending = await ProviderProfile.find({ verified: false }).populate('user categories');
  res.json(pending);
});

router.patch('/providers/:id/verify', async (req, res) => {
  const profile = await ProviderProfile.findByIdAndUpdate(
    req.params.id,
    { verified: true },
    { new: true }
  );
  if (!profile) return res.status(404).json({ error: 'Provider not found' });
  res.json(profile);
});

router.patch('/users/:id/ban', async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user._id, isActive: user.isActive });
});

router.post('/categories', async (req, res) => {
  const { name, slug } = req.body;
  const category = await Category.create({ name, slug });
  res.status(201).json(category);
});

// Basic per-city activity snapshot - swap in an aggregation pipeline for real analytics later
router.get('/overview', async (req, res) => {
  const { city } = req.query;
  const filter = city ? { city } : {};

  const [totalProviders, verifiedProviders, availableNow, openRequests, disputed] = await Promise.all([
    ProviderProfile.countDocuments(filter),
    ProviderProfile.countDocuments({ ...filter, verified: true }),
    ProviderProfile.countDocuments({ ...filter, available: true, verified: true }),
    ServiceRequest.countDocuments({ ...filter, status: { $in: ['pending_match', 'awaiting_acceptance'] } }),
    ServiceRequest.countDocuments({ ...filter, status: 'disputed' }),
  ]);

  res.json({ totalProviders, verifiedProviders, availableNow, openRequests, disputed });
});

module.exports = router;
