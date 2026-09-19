const express = require('express');
const ServiceRequest = require('../models/ServiceRequest');
const { requireAuth, requireRole } = require('../middleware/auth');
const { findRankedCandidates } = require('../services/matching');

const router = express.Router();
router.use(requireAuth, requireRole('customer'));

// Post a new service request. Runs the matching engine immediately and notifies
// the ranked candidates over sockets (see sockets/index.js for the push + accept race).
router.post('/requests', async (req, res) => {
  try {
    const { categoryId, description, photoUrl, longitude, latitude } = req.body;
    const city = req.user.city;

    const request = await ServiceRequest.create({
      customer: req.user.id,
      category: categoryId,
      city,
      description,
      photoUrl,
      location: { type: 'Point', coordinates: [longitude, latitude] },
    });

    const ranked = await findRankedCandidates({
      coordinates: [longitude, latitude],
      categoryId,
      city,
    });

    if (ranked.length === 0) {
      request.status = 'pending_match'; // stays open; a background job can retry as providers come online
      await request.save();
      return res.status(201).json({ request, matched: false, message: 'No available providers nearby yet' });
    }

    request.candidateProviders = ranked.map((r) => ({
      provider: r.provider._id,
      distanceMeters: r.distanceMeters,
    }));
    request.status = 'awaiting_acceptance';
    await request.save();

    req.app.get('io').notifyCandidates(request); // defined in sockets/index.js

    return res.status(201).json({ request, matched: true, candidateCount: ranked.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/requests', async (req, res) => {
  const requests = await ServiceRequest.find({ customer: req.user.id }).sort({ createdAt: -1 });
  res.json(requests);
});

module.exports = router;
