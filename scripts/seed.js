/**
 * scripts/seed.js
 * Run once to create the default teacher account and sample subjects.
 * Usage: npm run seed
 * Safe to run multiple times (idempotent).
 */
require('dotenv').config();
const { connectDB } = require('../database/db');
const User = require('../models/User');
const Class = require('../models/Class');

const seed = async () => {
  await connectDB();
  console.log('\n🌱 Starting seed...\n');

  // ── Default teacher ──────────────────────────────────────────────────────
  let teacher = await User.findOne({ email: 'teacher@test.com' });
  if (!teacher) {
    teacher = await User.create({
      name: 'Admin Teacher',
      email: 'teacher@test.com',
      password: 'password123', // hashed by pre-save hook
      role: 'teacher',
    });
    console.log('✅ Default teacher created');
  } else {
    console.log('ℹ️  Teacher already exists');
  }

  // ── Sample subjects ──────────────────────────────────────────────────────
  const subjects = [
    'Software Engineering',
    'Advanced Web Development',
    'Data Science & Visualization',
    'IoT Architecture & Protocols',
    'Mathematics',
    'Physics',
  ];

  for (const name of subjects) {
    const exists = await Class.findOne({ name, teacher: teacher._id });
    if (!exists) {
      await Class.create({ name, teacher: teacher._id });
      console.log(`✅ Subject created: ${name}`);
    } else {
      console.log(`ℹ️  Subject already exists: ${name}`);
    }
  }

  console.log('\n🎉 Seed complete!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Teacher login:  teacher@test.com');
  console.log('  Password:       password123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  process.exit(0);
};

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

