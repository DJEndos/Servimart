const express = require('express');
const ProviderProfile = require('../models/ProviderProfile');
const ServiceRequest = require('../models/ServiceRequest');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('provider'));

// Toggle availability - only affects matching when true. A verified check is
// enforced here too, since an unverified provider should never surface in $geoNear results.
router.patch('/availability', async (req, res) => {
  const profile = await ProviderProfile.findOne({ user: req.user.id });
  if (!profile) return res.status(404).json({ error: 'Provider profile not found' });
  if (!profile.verified) return res.status(403).json({ error: 'Account pending admin verification' });

  profile.available = Boolean(req.body.available);
  await profile.save();
  res.json({ available: profile.available });
});

// Called periodically by the provider app while available=true (every 30-60s or on
// a movement threshold - not a continuous stream, to save battery and bandwidth).
router.patch('/location', async (req, res) => {
  const { longitude, latitude } = req.body;
  const profile = await ProviderProfile.findOneAndUpdate(
    { user: req.user.id },
    { location: { type: 'Point', coordinates: [longitude, latitude] }, locationUpdatedAt: new Date() },
    { new: true }
  );
  if (!profile) return res.status(404).json({ error: 'Provider profile not found' });
  res.json({ location: profile.location });
});

// Accept a job offer. Uses findOneAndUpdate with a status guard so that if two
// providers hit accept within milliseconds of each other, only the first write wins -
// this is the race-condition fix referenced in sockets/index.js.
router.post('/requests/:id/accept', async (req, res) => {
  const profile = await ProviderProfile.findOne({ user: req.user.id });

  const request = await ServiceRequest.findOneAndUpdate(
    {
      _id: req.params.id,
      status: 'awaiting_acceptance',
      'candidateProviders.provider': profile._id,
    },
    {
      $set: { status: 'accepted', assignedProvider: profile._id },
    },
    { new: true }
  );

  if (!request) {
    return res.status(409).json({ error: 'Job already taken or no longer available' });
  }

  await ProviderProfile.updateOne({ _id: profile._id }, { $inc: { jobsAccepted: 1, jobsOffered: 1 } });
  req.app.get('io').notifyJobAssigned(request);

  res.json({ request });
});

router.post('/requests/:id/decline', async (req, res) => {
  const profile = await ProviderProfile.findOne({ user: req.user.id });
  await ServiceRequest.updateOne(
    { _id: req.params.id, 'candidateProviders.provider': profile._id },
    { $set: { 'candidateProviders.$.status': 'declined' } }
  );
  await ProviderProfile.updateOne({ _id: profile._id }, { $inc: { jobsOffered: 1 } });
  res.json({ ok: true });
});

module.exports = router;
