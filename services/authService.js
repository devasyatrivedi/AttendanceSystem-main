const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');

/**
 * Generates a signed JWT for a given user document.
 */
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '24h' });
};

/**
 * Registers a new student.
 * Expects validated body fields and an optional file from multer.
 * Returns the created user doc (without password) and a JWT.
 */
const registerStudent = async ({ name, email, enrollment, password }, file) => {
  // Build the photo path if a file was uploaded
  const photoPath = file ? `/python/dataset/${file.filename}` : null;

  const user = await User.create({
    name,
    email,
    enrollment,
    password, // pre-save hook in User.js hashes this
    role: 'student',
    photoPath,
  });

  const token = generateToken(user._id, user.role);
  return { token, user: { _id: user._id, name: user.name, enrollment: user.enrollment } };
};

/**
 * Authenticates a user by identifier (enrollment for students, email for teachers).
 * role: 'student' | 'teacher'
 */
const loginUser = async (identifier, password, role) => {
  let user;
  if (role === 'student') {
    user = await User.findOne({ enrollment: identifier, role: 'student' }).select('+password');
  } else {
    user = await User.findOne({ email: identifier, role }).select('+password');
  }

  if (!user) throw new Error('Invalid credentials');

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new Error('Invalid credentials');

  const token = generateToken(user._id, user.role);
  return { token, user: { _id: user._id, name: user.name, role: user.role } };
};

module.exports = { registerStudent, loginUser, generateToken };
