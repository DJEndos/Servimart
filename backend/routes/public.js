const express = require('express');
const Category = require('../models/Category');
const ProviderProfile = require('../models/ProviderProfile');

const router = express.Router();

// No auth on this router by design - it's the "least privilege" browse layer for
// anonymous visitors. Keep it strictly read-only and never return PII (phone, email,
// exact coordinates, bank details) through here.

router.get('/categories', async (req, res) => {
  const categories = await Category.find({ isActive: true }).select('name slug');
  res.json(categories);
});

// City-level coverage counts for the landing page - no individual provider identity exposed.
router.get('/coverage', async (req, res) => {
  const cities = await ProviderProfile.aggregate([
    { $match: { verified: true } },
    { $group: { _id: '$city', providerCount: { $sum: 1 } } },
    { $project: { _id: 0, city: '$_id', providerCount: 1 } },
    { $sort: { providerCount: -1 } },
  ]);
  res.json(cities);
});

// A minimal, non-identifying sample so a visitor can see "who's out there" before
// registering - trade and rating only, never name/phone/exact location.
router.get('/providers/sample', async (req, res) => {
  const { city, category } = req.query;
  const filter = { verified: true };
  if (city) filter.city = city;
  if (category) filter.categories = category;

  const sample = await ProviderProfile.find(filter)
    .select('city ratingAverage jobsCompleted')
    .populate('categories', 'name')
    .limit(12);

  res.json(sample);
});

module.exports = router;
