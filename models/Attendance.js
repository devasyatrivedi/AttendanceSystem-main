const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: true,
    },
    // Store as Date midnight UTC so daily grouping works cleanly
    date: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['Present', 'Absent'],
      required: true,
    },
    markedBy: {
      type: String,
      enum: ['manual', 'auto-face'],
      default: 'manual',
    },
  },
  { timestamps: true }
);

// Replaces PostgreSQL: UNIQUE (student_id, subject_id, date)
attendanceSchema.index({ student: 1, classId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
