const mongoose = require('mongoose');

// Replaces the PostgreSQL 'subjects' table.
// Renamed to 'Class' to match the target architecture spec.
const classSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Class name is required'],
      trim: true,
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Teacher is required'],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Class', classSchema);
