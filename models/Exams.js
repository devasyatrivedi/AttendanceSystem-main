const mongoose = require('mongoose');

// Phase 1 scaffold — full CRUD logic added in Phase 4
const examSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    totalMarks: {
      type: Number,
      required: true,
      min: 1,
    },
    // Per-student result sub-documents
    results: [
      {
        student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        marksObtained: { type: Number, min: 0 },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Exam', examSchema);
