
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function seedAdmin() {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PHONE, ADMIN_PASSWORD, ADMIN_CITY } = process.env;

  const missing = ['ADMIN_NAME', 'ADMIN_EMAIL', 'ADMIN_PHONE', 'ADMIN_PASSWORD', 'ADMIN_CITY'].filter(
    (k) => !process.env[k]
  );
  if (missing.length) {
    console.error(`Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
  }
  if (ADMIN_PASSWORD.length < 10) {
    console.error('ADMIN_PASSWORD should be at least 10 characters for a production account.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const existing = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });

  if (existing) {
    existing.passwordHash = passwordHash;
    existing.role = 'admin';
    existing.isActive = true;
    existing.name = ADMIN_NAME;
    existing.phone = ADMIN_PHONE;
    existing.city = ADMIN_CITY;
    await existing.save();
    console.log(`Updated existing admin: ${existing.email}`);
  } else {
    const admin = await User.create({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL.toLowerCase(),
      phone: ADMIN_PHONE,
      passwordHash,
      role: 'admin',
      city: ADMIN_CITY,
    });
    console.log(`Created admin: ${admin.email}`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
