const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ProviderProfile = require('../models/ProviderProfile');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role, city: user.city },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// Customers and providers self-register here. Admins are seeded directly in the DB, not via this route.
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, city, role, categoryIds } = req.body;

    if (!['customer', 'provider'].includes(role)) {
      return res.status(400).json({ error: 'Role must be customer or provider' });
    }

    const existing = await User.findOne({ $or: [{ email }, { phone }] });
    if (existing) return res.status(409).json({ error: 'Email or phone already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, phone, passwordHash, city, role });

    if (role === 'provider') {
      // Provider starts unverified and unavailable until admin approves and they toggle on
      await ProviderProfile.create({
        user: user._id,
        categories: categoryIds || [],
        city,
        available: false,
        verified: false,
      });
    }

    return res.status(201).json({ token: signToken(user), user: { id: user._id, role: user.role } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !user.isActive) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    return res.json({ token: signToken(user), user: { id: user._id, role: user.role, name: user.name } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
